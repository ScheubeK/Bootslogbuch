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
  delete from public.costs where boat_id = target_boat_id;
end;
$$;

grant execute on function public.reset_boat_data(uuid) to authenticated;
