-- Der See bestimmt ausschliesslich die automatisch vorgeschlagene Wassertemperatur.
-- Wetterort und See sind bewusst getrennt konfigurierbar.
alter table public.boats
  add column water_lake text not null default 'lucernekreuztrichterandvitznauerbecken'
  check (water_lake in (
    'lucernekreuztrichterandvitznauerbecken',
    'zug',
    'walensee',
    'upperzurich',
    'lowerzurich',
    'thun',
    'brienz',
    'upperconstance',
    'lowerconstance',
    'geneva',
    'maggiore',
    'upperlugano',
    'lowerlugano'
  ));
