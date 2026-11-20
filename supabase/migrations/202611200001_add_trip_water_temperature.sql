-- Wassertemperatur wird getrennt von der Lufttemperatur eines Ausflugs gespeichert.
alter table public.trips
  add column water_temperature_c numeric(5, 1);

-- Excel-Sicherungen dürfen die neue Spalte ebenfalls wiederherstellen.
create or replace function public.import_boat_backup(
  target_boat_id uuid,
  trip_rows jsonb,
  cost_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  trip_count integer := 0;
  cost_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Anmeldung erforderlich';
  end if;

  if not public.is_boat_owner(target_boat_id) then
    raise exception 'Nur der Kapitän darf eine Sicherung importieren';
  end if;

  if coalesce(jsonb_typeof(trip_rows), '') <> 'array'
     or coalesce(jsonb_typeof(cost_rows), '') <> 'array' then
    raise exception 'Importdaten müssen Listen von Ausflügen und Kosten enthalten';
  end if;

  trip_count := jsonb_array_length(trip_rows);
  cost_count := jsonb_array_length(cost_rows);
  if trip_count > 1000 or cost_count > 1000 then
    raise exception 'Eine Sicherung darf höchstens 1000 Ausflüge und 1000 Kosten enthalten';
  end if;

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

  insert into public.costs (
    boat_id, cost_date, category, description, amount_chf, litres,
    price_per_litre, created_by
  )
  select
    target_boat_id,
    (entry.value ->> 'cost_date')::date,
    (entry.value ->> 'category')::public.cost_category,
    coalesce(nullif(entry.value ->> 'description', ''), ''),
    (entry.value ->> 'amount_chf')::numeric,
    nullif(entry.value ->> 'litres', '')::numeric,
    nullif(entry.value ->> 'price_per_litre', '')::numeric,
    auth.uid()
  from jsonb_array_elements(cost_rows) as entry(value);

  return jsonb_build_object('trips', trip_count, 'costs', cost_count);
end;
$$;

revoke all on function public.import_boat_backup(uuid, jsonb, jsonb) from public;
grant execute on function public.import_boat_backup(uuid, jsonb, jsonb) to authenticated;
