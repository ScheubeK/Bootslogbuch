-- Kosten teilen für Bootsgemeinschaften.
-- Die Kostenbeteiligten werden pro Boot festgelegt. Bei einer geteilten
-- Ausgabe wird der Zahler sowie der eingefrorene Anteil jeder Person erfasst.

alter table public.costs
  add column if not exists paid_by uuid references public.profiles(id) on delete restrict;

create table if not exists public.boat_cost_participants (
  boat_id uuid not null references public.boats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (boat_id, user_id)
);

create table if not exists public.cost_shares (
  cost_id uuid not null references public.costs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  share_amount numeric(12, 4) not null check (share_amount >= 0),
  primary key (cost_id, user_id)
);

create table if not exists public.cost_settlements (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid not null references public.boats(id) on delete cascade,
  settlement_date date not null,
  from_user_id uuid not null references public.profiles(id) on delete restrict,
  to_user_id uuid not null references public.profiles(id) on delete restrict,
  amount_chf numeric(12, 2) not null check (amount_chf > 0),
  note text not null default '',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

create index if not exists cost_settlements_boat_date_idx
  on public.cost_settlements (boat_id, settlement_date desc);

create or replace function public.validate_boat_cost_participant()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.boat_memberships
    where boat_id = new.boat_id and user_id = new.user_id
  ) then
    raise exception 'Kostenbeteiligte müssen Mitglied dieses Boots sein.';
  end if;
  return new;
end;
$$;

drop trigger if exists boat_cost_participants_validate_member on public.boat_cost_participants;
create trigger boat_cost_participants_validate_member
before insert or update of boat_id, user_id on public.boat_cost_participants
for each row execute function public.validate_boat_cost_participant();

create or replace function public.validate_cost_paid_by()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.paid_by is not null and not exists (
    select 1 from public.boat_cost_participants
    where boat_id = new.boat_id and user_id = new.paid_by
  ) then
    raise exception 'Die zahlende Person muss als Kostenbeteiligte dieses Boots hinterlegt sein.';
  end if;
  return new;
end;
$$;

drop trigger if exists costs_validate_paid_by on public.costs;
create trigger costs_validate_paid_by
before insert or update of boat_id, paid_by on public.costs
for each row execute function public.validate_cost_paid_by();

create or replace function public.validate_cost_share()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target_boat_id uuid;
begin
  select boat_id into target_boat_id from public.costs where id = new.cost_id;
  if target_boat_id is null or not exists (
    select 1 from public.boat_cost_participants
    where boat_id = target_boat_id and user_id = new.user_id
  ) then
    raise exception 'Kostenanteile dürfen nur für Kostenbeteiligte dieses Boots erfasst werden.';
  end if;
  return new;
end;
$$;

drop trigger if exists cost_shares_validate_participant on public.cost_shares;
create trigger cost_shares_validate_participant
before insert or update of cost_id, user_id on public.cost_shares
for each row execute function public.validate_cost_share();

create or replace function public.validate_cost_settlement()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.boat_cost_participants
    where boat_id = new.boat_id and user_id = new.from_user_id
  ) or not exists (
    select 1 from public.boat_cost_participants
    where boat_id = new.boat_id and user_id = new.to_user_id
  ) then
    raise exception 'Ausgleichszahlungen sind nur zwischen Kostenbeteiligten möglich.';
  end if;
  return new;
end;
$$;

drop trigger if exists cost_settlements_validate_participants on public.cost_settlements;
create trigger cost_settlements_validate_participants
before insert or update of boat_id, from_user_id, to_user_id on public.cost_settlements
for each row execute function public.validate_cost_settlement();

alter table public.boat_cost_participants enable row level security;
alter table public.cost_shares enable row level security;
alter table public.cost_settlements enable row level security;

create policy "Crew can read cost participants"
on public.boat_cost_participants for select to authenticated
using (public.is_boat_member(boat_id));
create policy "Owners can manage cost participants"
on public.boat_cost_participants for insert to authenticated
with check (public.is_boat_owner(boat_id));
create policy "Owners can remove cost participants"
on public.boat_cost_participants for delete to authenticated
using (public.is_boat_owner(boat_id));

create policy "Crew can read cost shares"
on public.cost_shares for select to authenticated
using (exists (select 1 from public.costs where costs.id = cost_id and public.is_boat_member(costs.boat_id)));
create policy "Crew can manage cost shares"
on public.cost_shares for insert to authenticated
with check (exists (select 1 from public.costs where costs.id = cost_id and public.is_boat_member(costs.boat_id)));
create policy "Crew can update cost shares"
on public.cost_shares for update to authenticated
using (exists (select 1 from public.costs where costs.id = cost_id and public.is_boat_member(costs.boat_id)))
with check (exists (select 1 from public.costs where costs.id = cost_id and public.is_boat_member(costs.boat_id)));
create policy "Crew can delete cost shares"
on public.cost_shares for delete to authenticated
using (exists (select 1 from public.costs where costs.id = cost_id and public.is_boat_member(costs.boat_id)));

create policy "Crew can read settlements"
on public.cost_settlements for select to authenticated
using (public.is_boat_member(boat_id));
create policy "Crew can create settlements"
on public.cost_settlements for insert to authenticated
with check (public.is_boat_member(boat_id) and created_by = auth.uid());
create policy "Crew can update settlements"
on public.cost_settlements for update to authenticated
using (public.is_boat_member(boat_id)) with check (public.is_boat_member(boat_id));
create policy "Crew can delete settlements"
on public.cost_settlements for delete to authenticated
using (public.is_boat_member(boat_id));

grant select, insert, delete on public.boat_cost_participants to authenticated;
grant select, insert, update, delete on public.cost_shares to authenticated;
grant select, insert, update, delete on public.cost_settlements to authenticated;
