-- Der Kapitän kann Daten eines einzelnen Kalenderjahres löschen.
-- Kostenanteile werden beim Löschen der Kosten automatisch entfernt.

create or replace function public.delete_boat_year_data(
  target_boat_id uuid,
  target_year integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_boat_owner(target_boat_id) then
    raise exception 'Nur der Kapitän kann Logbuchdaten löschen.';
  end if;

  if target_year < 1900 or target_year > 2200 then
    raise exception 'Ungültiges Jahr';
  end if;

  delete from public.active_trips
  where boat_id = target_boat_id
    and extract(year from started_at at time zone 'Europe/Zurich') = target_year;

  delete from public.trips
  where boat_id = target_boat_id
    and extract(year from start_at at time zone 'Europe/Zurich') = target_year;

  delete from public.cost_settlements
  where boat_id = target_boat_id
    and extract(year from settlement_date) = target_year;

  delete from public.costs
  where boat_id = target_boat_id
    and extract(year from cost_date) = target_year;
end;
$$;

grant execute on function public.delete_boat_year_data(uuid, integer) to authenticated;
