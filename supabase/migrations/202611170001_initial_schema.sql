-- Bootslogbuch: gemeinsamer Datenbereich pro Boot.
-- Diese Migration wird im Supabase SQL Editor ausgeführt oder später über die
-- Supabase CLI angewendet. Alle Tabellen sind durch Row Level Security geschützt.

create extension if not exists pgcrypto;

create type public.boat_role as enum ('owner', 'crew');
create type public.cost_category as enum ('Benzin', 'Versicherungen', 'Steuern', 'Bootsplatz', 'Unterhalt');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.boats (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.boat_memberships (
  boat_id uuid not null references public.boats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.boat_role not null default 'crew',
  created_at timestamptz not null default now(),
  primary key (boat_id, user_id)
);

create table public.boat_invitations (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid not null references public.boats(id) on delete cascade,
  email text not null check (email = lower(email)),
  role public.boat_role not null default 'crew' check (role = 'crew'),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  unique (boat_id, email)
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid not null references public.boats(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  engine_start numeric(10, 2) not null check (engine_start >= 0),
  engine_end numeric(10, 2) not null check (engine_end >= engine_start),
  wine_bottles integer not null default 0 check (wine_bottles between 0 and 99),
  remarks text not null default '',
  weather text,
  temperature_c numeric(5, 1),
  wind_kmh numeric(5, 1),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at >= start_at)
);

create table public.costs (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid not null references public.boats(id) on delete cascade,
  cost_date date not null,
  category public.cost_category not null,
  description text not null default '',
  amount_chf numeric(12, 2) not null check (amount_chf >= 0),
  litres numeric(10, 2) check (litres is null or litres >= 0),
  price_per_litre numeric(10, 3) check (price_per_litre is null or price_per_litre >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (category = 'Benzin' and (litres is null or price_per_litre is null or litres * price_per_litre >= 0))
    or (category <> 'Benzin' and litres is null and price_per_litre is null)
  )
);

create index trips_boat_start_at_idx on public.trips (boat_id, start_at desc);
create index costs_boat_date_idx on public.costs (boat_id, cost_date desc);
create index invitations_email_idx on public.boat_invitations (email) where accepted_at is null;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger boats_set_updated_at before update on public.boats
for each row execute function public.set_updated_at();
create trigger trips_set_updated_at before update on public.trips
for each row execute function public.set_updated_at();
create trigger costs_set_updated_at before update on public.costs
for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    lower(new.email),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Security-definer helpers avoid RLS recursion in the policies below.
create function public.is_boat_member(target_boat_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.boat_memberships
    where boat_id = target_boat_id and user_id = auth.uid()
  );
$$;

create function public.is_boat_owner(target_boat_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.boat_memberships
    where boat_id = target_boat_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create function public.can_view_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select target_profile_id = auth.uid() or exists (
    select 1
    from public.boat_memberships mine
    join public.boat_memberships theirs on theirs.boat_id = mine.boat_id
    where mine.user_id = auth.uid() and theirs.user_id = target_profile_id
  );
$$;

create function public.create_boat(boat_name text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  new_boat_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Anmeldung erforderlich';
  end if;

  insert into public.boats (name, created_by)
  values (trim(boat_name), auth.uid())
  returning id into new_boat_id;

  insert into public.boat_memberships (boat_id, user_id, role)
  values (new_boat_id, auth.uid(), 'owner');

  return new_boat_id;
end;
$$;

create function public.accept_boat_invitation(invitation_token uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  invitation public.boat_invitations;
  current_email text;
begin
  if auth.uid() is null then
    raise exception 'Anmeldung erforderlich';
  end if;

  current_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  select * into invitation
  from public.boat_invitations
  where token = invitation_token and accepted_at is null and expires_at > now()
  for update;

  if not found then
    raise exception 'Einladung ist ungültig oder abgelaufen';
  end if;
  if invitation.email <> current_email then
    raise exception 'Diese Einladung gehört zu einer anderen E-Mail-Adresse';
  end if;

  insert into public.boat_memberships (boat_id, user_id, role)
  values (invitation.boat_id, auth.uid(), invitation.role)
  on conflict (boat_id, user_id) do update set role = excluded.role;

  update public.boat_invitations set accepted_at = now() where id = invitation.id;
  return invitation.boat_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.boats enable row level security;
alter table public.boat_memberships enable row level security;
alter table public.boat_invitations enable row level security;
alter table public.trips enable row level security;
alter table public.costs enable row level security;

create policy "Profiles are visible to the same crew"
on public.profiles for select to authenticated
using (public.can_view_profile(id));
create policy "Users can update their profile"
on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy "Crew can read their boats"
on public.boats for select to authenticated
using (public.is_boat_member(id));
create policy "Owners can update their boats"
on public.boats for update to authenticated
using (public.is_boat_owner(id)) with check (public.is_boat_owner(id));
create policy "Owners can delete their boats"
on public.boats for delete to authenticated
using (public.is_boat_owner(id));

create policy "Crew can read memberships"
on public.boat_memberships for select to authenticated
using (public.is_boat_member(boat_id));
create policy "Owners can remove crew"
on public.boat_memberships for delete to authenticated
using (public.is_boat_owner(boat_id) or user_id = auth.uid());

create policy "Crew can read their invitations"
on public.boat_invitations for select to authenticated
using (public.is_boat_owner(boat_id) or email = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy "Owners can invite crew"
on public.boat_invitations for insert to authenticated
with check (public.is_boat_owner(boat_id) and invited_by = auth.uid());
create policy "Owners can revoke invitations"
on public.boat_invitations for delete to authenticated
using (public.is_boat_owner(boat_id));

create policy "Crew can read trips"
on public.trips for select to authenticated
using (public.is_boat_member(boat_id));
create policy "Crew can create trips"
on public.trips for insert to authenticated
with check (public.is_boat_member(boat_id) and created_by = auth.uid());
create policy "Crew can update trips"
on public.trips for update to authenticated
using (public.is_boat_member(boat_id)) with check (public.is_boat_member(boat_id));
create policy "Crew can delete trips"
on public.trips for delete to authenticated
using (public.is_boat_member(boat_id));

create policy "Crew can read costs"
on public.costs for select to authenticated
using (public.is_boat_member(boat_id));
create policy "Crew can create costs"
on public.costs for insert to authenticated
with check (public.is_boat_member(boat_id) and created_by = auth.uid());
create policy "Crew can update costs"
on public.costs for update to authenticated
using (public.is_boat_member(boat_id)) with check (public.is_boat_member(boat_id));
create policy "Crew can delete costs"
on public.costs for delete to authenticated
using (public.is_boat_member(boat_id));

grant usage on schema public to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, update, delete on public.boats to authenticated;
grant select, delete on public.boat_memberships to authenticated;
grant select, insert, delete on public.boat_invitations to authenticated;
grant select, insert, update, delete on public.trips to authenticated;
grant select, insert, update, delete on public.costs to authenticated;
grant execute on function public.create_boat(text) to authenticated;
grant execute on function public.accept_boat_invitation(uuid) to authenticated;
