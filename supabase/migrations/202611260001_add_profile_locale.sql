alter table public.profiles
  add column locale text not null default 'de'
  check (locale in ('de', 'en'));
