alter table public.boats
  add column weather_location text not null default 'Hergiswil NW, Schweiz',
  add column weather_lat numeric(8, 5) not null default 46.98515,
  add column weather_lon numeric(8, 5) not null default 8.30956;
