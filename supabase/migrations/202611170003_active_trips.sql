-- A running trip is stored separately until the crew completes the log entry.
-- This keeps the start time available after the browser is suspended or closed.
create table public.active_trips (
  boat_id uuid primary key references public.boats(id) on delete cascade,
  started_at timestamptz not null default now(),
  started_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.active_trips enable row level security;

create policy "Crew can read active trips"
on public.active_trips for select to authenticated
using (public.is_boat_member(boat_id));

create policy "Crew can start active trips"
on public.active_trips for insert to authenticated
with check (public.is_boat_member(boat_id) and started_by = auth.uid());

create policy "Crew can clear active trips"
on public.active_trips for delete to authenticated
using (public.is_boat_member(boat_id));

grant select, insert, delete on public.active_trips to authenticated;
