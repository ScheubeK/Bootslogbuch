-- Vollständiger Excel-Backup-Import inklusive Kostenaufteilung.
-- Personen werden ausschliesslich über ihre E-Mail-Adresse zugeordnet und
-- müssen beim Zielboot bereits als Mitglied vorhanden sein.

create or replace function public.import_boat_backup_full(
  target_boat_id uuid,
  trip_rows jsonb,
  cost_rows jsonb,
  participant_rows jsonb,
  share_rows jsonb,
  settlement_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  entry jsonb;
  source_cost_id text;
  email_address text;
  payer_id uuid;
  person_id uuid;
  imported_cost_id uuid;
  trip_count integer := 0;
  cost_count integer := 0;
  participant_count integer := 0;
  share_count integer := 0;
  settlement_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Anmeldung erforderlich';
  end if;

  if not public.is_boat_owner(target_boat_id) then
    raise exception 'Nur der Kapitän darf eine Sicherung importieren';
  end if;

  if coalesce(jsonb_typeof(trip_rows), '') <> 'array'
     or coalesce(jsonb_typeof(cost_rows), '') <> 'array'
     or coalesce(jsonb_typeof(participant_rows), '') <> 'array'
     or coalesce(jsonb_typeof(share_rows), '') <> 'array'
     or coalesce(jsonb_typeof(settlement_rows), '') <> 'array' then
    raise exception 'Importdaten müssen Listen enthalten';
  end if;

  trip_count := jsonb_array_length(trip_rows);
  cost_count := jsonb_array_length(cost_rows);
  participant_count := jsonb_array_length(participant_rows);
  share_count := jsonb_array_length(share_rows);
  settlement_count := jsonb_array_length(settlement_rows);
  if trip_count > 1000 or cost_count > 1000 or participant_count > 100 or share_count > 10000 or settlement_count > 5000 then
    raise exception 'Die Sicherung ist zu gross';
  end if;

  create temporary table if not exists import_backup_users (
    email text primary key,
    user_id uuid not null
  ) on commit drop;
  truncate import_backup_users;
  create temporary table if not exists import_backup_required_participants (
    user_id uuid primary key
  ) on commit drop;
  truncate import_backup_required_participants;
  create temporary table if not exists import_backup_configured_participants (
    user_id uuid primary key
  ) on commit drop;
  truncate import_backup_configured_participants;
  create temporary table if not exists import_backup_existing_participants (
    user_id uuid primary key
  ) on commit drop;
  truncate import_backup_existing_participants;
  create temporary table if not exists import_backup_cost_map (
    source_cost_id text primary key,
    cost_id uuid not null
  ) on commit drop;
  truncate import_backup_cost_map;

  insert into import_backup_existing_participants (user_id)
  select user_id from public.boat_cost_participants where boat_id = target_boat_id;

  -- Jede referenzierte E-Mail muss zu einem bestehenden Bootsmitglied gehören.
  for entry in select value from jsonb_array_elements(participant_rows) loop
    email_address := lower(trim(coalesce(entry ->> 'email', '')));
    if email_address = '' then raise exception 'Kostenbeteiligte ohne E-Mail-Adresse können nicht importiert werden'; end if;
    select p.id into person_id from public.profiles p join public.boat_memberships m on m.user_id = p.id where m.boat_id = target_boat_id and lower(p.email) = email_address;
    if person_id is null then raise exception 'Die Person % muss vor dem Import als Crewmitglied dieses Boots hinterlegt sein', email_address; end if;
    insert into import_backup_users (email, user_id) values (email_address, person_id) on conflict (email) do nothing;
    insert into import_backup_required_participants (user_id) values (person_id) on conflict do nothing;
    insert into import_backup_configured_participants (user_id) values (person_id) on conflict do nothing;
  end loop;

  for entry in select value from jsonb_array_elements(cost_rows) loop
    email_address := lower(trim(coalesce(entry ->> 'paid_by_email', '')));
    if email_address <> '' then
      select p.id into person_id from public.profiles p join public.boat_memberships m on m.user_id = p.id where m.boat_id = target_boat_id and lower(p.email) = email_address;
      if person_id is null then raise exception 'Die zahlende Person % muss vor dem Import als Crewmitglied dieses Boots hinterlegt sein', email_address; end if;
      insert into import_backup_users (email, user_id) values (email_address, person_id) on conflict (email) do nothing;
      insert into import_backup_required_participants (user_id) values (person_id) on conflict do nothing;
    end if;
  end loop;

  for entry in select value from jsonb_array_elements(share_rows) loop
    email_address := lower(trim(coalesce(entry ->> 'user_email', '')));
    if email_address = '' then raise exception 'Kostenanteil ohne E-Mail-Adresse kann nicht importiert werden'; end if;
    select p.id into person_id from public.profiles p join public.boat_memberships m on m.user_id = p.id where m.boat_id = target_boat_id and lower(p.email) = email_address;
    if person_id is null then raise exception 'Die beteiligte Person % muss vor dem Import als Crewmitglied dieses Boots hinterlegt sein', email_address; end if;
    insert into import_backup_users (email, user_id) values (email_address, person_id) on conflict (email) do nothing;
    insert into import_backup_required_participants (user_id) values (person_id) on conflict do nothing;
  end loop;

  for entry in select value from jsonb_array_elements(settlement_rows) loop
    foreach email_address in array array[lower(trim(coalesce(entry ->> 'from_email', ''))), lower(trim(coalesce(entry ->> 'to_email', '')))] loop
      if email_address = '' then raise exception 'Ausgleichszahlung ohne E-Mail-Adresse kann nicht importiert werden'; end if;
      select p.id into person_id from public.profiles p join public.boat_memberships m on m.user_id = p.id where m.boat_id = target_boat_id and lower(p.email) = email_address;
      if person_id is null then raise exception 'Die Person % muss vor dem Import als Crewmitglied dieses Boots hinterlegt sein', email_address; end if;
      insert into import_backup_users (email, user_id) values (email_address, person_id) on conflict (email) do nothing;
      insert into import_backup_required_participants (user_id) values (person_id) on conflict do nothing;
    end loop;
  end loop;

  -- Temporär auch historische Beteiligte zulassen, damit ihre eingefrorenen
  -- Anteile die Validierung passieren. Nach dem Import wird die aktuelle
  -- Konfiguration wieder auf die exportierte Liste zurückgeführt.
  insert into public.boat_cost_participants (boat_id, user_id)
  select target_boat_id, user_id from import_backup_required_participants
  on conflict do nothing;

  insert into public.trips (
    boat_id, start_at, end_at, engine_start, engine_end, wine_bottles,
    remarks, weather, temperature_c, water_temperature_c, wind_kmh, created_by
  )
  select
    target_boat_id,
    (entry.value ->> 'start_at')::timestamptz,
    (entry.value ->> 'end_at')::timestamptz,
    (entry.value ->> 'engine_start')::numeric,
    (entry.value ->> 'engine_end')::numeric,
    coalesce(nullif(entry.value ->> 'wine_bottles', '')::integer, 0),
    coalesce(nullif(entry.value ->> 'remarks', ''), ''),
    nullif(entry.value ->> 'weather', ''),
    nullif(entry.value ->> 'temperature_c', '')::numeric,
    nullif(entry.value ->> 'water_temperature_c', '')::numeric,
    nullif(entry.value ->> 'wind_kmh', '')::numeric,
    auth.uid()
  from jsonb_array_elements(trip_rows) as entry(value);

  for entry in select value from jsonb_array_elements(cost_rows) loop
    source_cost_id := trim(coalesce(entry ->> 'source_cost_id', ''));
    if source_cost_id = '' then raise exception 'Jeder Kostenposten benötigt eine Backup-Kosten-ID'; end if;
    if exists (select 1 from import_backup_cost_map where import_backup_cost_map.source_cost_id = source_cost_id) then
      raise exception 'Die Backup-Kosten-ID % kommt mehrfach vor', source_cost_id;
    end if;
    email_address := lower(trim(coalesce(entry ->> 'paid_by_email', '')));
    payer_id := null;
    if email_address <> '' then
      select user_id into payer_id from import_backup_users where email = email_address;
    end if;
    insert into public.costs (
      boat_id, cost_date, category, description, amount_chf, litres,
      price_per_litre, paid_by, created_by
    ) values (
      target_boat_id,
      (entry ->> 'cost_date')::date,
      (entry ->> 'category')::public.cost_category,
      coalesce(nullif(entry ->> 'description', ''), ''),
      (entry ->> 'amount_chf')::numeric,
      nullif(entry ->> 'litres', '')::numeric,
      nullif(entry ->> 'price_per_litre', '')::numeric,
      payer_id,
      auth.uid()
    ) returning id into imported_cost_id;
    insert into import_backup_cost_map (source_cost_id, cost_id) values (source_cost_id, imported_cost_id);
  end loop;

  for entry in select value from jsonb_array_elements(share_rows) loop
    source_cost_id := trim(coalesce(entry ->> 'source_cost_id', ''));
    select cost_id into imported_cost_id from import_backup_cost_map where import_backup_cost_map.source_cost_id = source_cost_id;
    if imported_cost_id is null then raise exception 'Kostenanteil verweist auf unbekannte Backup-Kosten-ID %', source_cost_id; end if;
    email_address := lower(trim(coalesce(entry ->> 'user_email', '')));
    select user_id into person_id from import_backup_users where email = email_address;
    insert into public.cost_shares (cost_id, user_id, share_amount)
    values (imported_cost_id, person_id, (entry ->> 'share_amount')::numeric);
  end loop;

  for entry in select value from jsonb_array_elements(settlement_rows) loop
    select user_id into person_id from import_backup_users where email = lower(trim(entry ->> 'from_email'));
    select user_id into payer_id from import_backup_users where email = lower(trim(entry ->> 'to_email'));
    insert into public.cost_settlements (boat_id, settlement_date, from_user_id, to_user_id, amount_chf, note, created_by)
    values (
      target_boat_id,
      (entry ->> 'settlement_date')::date,
      person_id,
      payer_id,
      (entry ->> 'amount_chf')::numeric,
      coalesce(nullif(entry ->> 'note', ''), ''),
      auth.uid()
    );
  end loop;

  -- Personen, die nur für historische Anteile kurz benötigt wurden, bleiben
  -- nicht automatisch als aktuelle Kostenbeteiligte aktiviert.
  delete from public.boat_cost_participants participant
  using import_backup_required_participants required
  where participant.boat_id = target_boat_id
    and participant.user_id = required.user_id
    and not exists (select 1 from import_backup_configured_participants configured where configured.user_id = participant.user_id)
    and not exists (select 1 from import_backup_existing_participants existing where existing.user_id = participant.user_id);

  return jsonb_build_object(
    'trips', trip_count,
    'costs', cost_count,
    'participants', participant_count,
    'shares', share_count,
    'settlements', settlement_count
  );
end;
$$;

revoke all on function public.import_boat_backup_full(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.import_boat_backup_full(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- Beim Zurücksetzen gehören auch bereits gebuchte Ausgleichszahlungen zu den
-- Kostendaten. Kostenanteile werden über die Kosten selbst automatisch gelöscht.
create or replace function public.reset_boat_data(target_boat_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_boat_owner(target_boat_id) then
    raise exception 'Nur der Kapitän kann das Logbuch löschen.';
  end if;

  delete from public.active_trips where boat_id = target_boat_id;
  delete from public.trips where boat_id = target_boat_id;
  delete from public.cost_settlements where boat_id = target_boat_id;
  delete from public.costs where boat_id = target_boat_id;
end;
$$;

grant execute on function public.reset_boat_data(uuid) to authenticated;
