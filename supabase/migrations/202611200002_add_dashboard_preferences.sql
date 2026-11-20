-- Persönliche Dashboard-Auswahl. Die Einstellung gehört zum Benutzer und ist
-- damit auf allen Geräten und für alle Bootszugehörigkeiten verfügbar.

alter table public.profiles
  add column if not exists dashboard_metrics jsonb not null default '["trips", "engine", "seaTime", "wine", "costPerEngine", "costPerTrip", "costTotal"]'::jsonb;

comment on column public.profiles.dashboard_metrics is
  'Vom Benutzer gewählte Kennzahlen für das Dashboard.';
