-- Import für Bennos Boot: 63 gültige Ausflüge (2025–2026) und 14 Kostenpositionen.
-- Wichtig: Zuerst unten die Boot-ID ersetzen. Der Import ergänzt Daten; er löscht nichts.
-- Die Daten werden dem aktuellen Kapitän des ausgewählten Boots als Ersteller zugeordnet.
--
-- Zwei Quellzeilen sind absichtlich ausgeschlossen, weil sie gegen die Datenbankregeln verstossen:
-- Nicht importiert: 2026-05-23 22:23 bis 2026-05-23 19:47; Motor 591.8 → 593.8.
-- Nicht importiert: 2026-07-29 12:34 bis 2026-07-29 18:04; Motor 635.4 → 623.7.
-- Diese bei Bedarf nach Korrektur separat ergänzen.

begin;

do $$
declare
  target_boat_id uuid := 'BOOT-ID-HIER-EINFÜGEN';
  import_user_id uuid;
begin
  select user_id into import_user_id
  from public.boat_memberships
  where boat_id = target_boat_id and role = 'owner'
  order by created_at
  limit 1;

  if import_user_id is null then
    raise exception 'Für die angegebene Boot-ID wurde kein Kapitän gefunden.';
  end if;

  insert into public.trips (
    boat_id, start_at, end_at, engine_start, engine_end, wine_bottles,
    remarks, weather, temperature_c, wind_kmh, created_by
  )
  values
    (target_boat_id, (timestamp '2025-04-03 15:30' at time zone 'Europe/Zurich'), (timestamp '2025-04-03 17:00' at time zone 'Europe/Zurich'), 546.50, 547.30, 0, 'Alpnach Stad → Lopperhafen · Einwassern / Alpnach Stad ( geak eschliffen und geölt)', null, 17, null, import_user_id),
    (target_boat_id, (timestamp '2025-04-12 12:30' at time zone 'Europe/Zurich'), (timestamp '2025-04-12 16:00' at time zone 'Europe/Zurich'), 547.30, 548.50, 0, 'Lopperhafen → Luzerner Bucht', null, 20, null, import_user_id),
    (target_boat_id, (timestamp '2025-04-19 14:00' at time zone 'Europe/Zurich'), (timestamp '2025-04-19 19:00' at time zone 'Europe/Zurich'), 548.50, 550.20, 0, 'Lopperhafen → Horwer', null, 19, null, import_user_id),
    (target_boat_id, (timestamp '2025-05-11 11:30' at time zone 'Europe/Zurich'), (timestamp '2025-05-11 17:00' at time zone 'Europe/Zurich'), 550.20, 551, 0, 'Lopperhafen → Horwer', null, 23, null, import_user_id),
    (target_boat_id, (timestamp '2025-05-30 10:30' at time zone 'Europe/Zurich'), (timestamp '2025-05-30 20:20' at time zone 'Europe/Zurich'), 551, 552, 0, 'Lopperhafen → Postune', null, 24, null, import_user_id),
    (target_boat_id, (timestamp '2025-05-31 08:00' at time zone 'Europe/Zurich'), (timestamp '2025-05-31 16:30' at time zone 'Europe/Zurich'), 550.20, 554, 0, 'Lopperhafen → Postune', null, 26, null, import_user_id),
    (target_boat_id, (timestamp '2025-06-09 11:15' at time zone 'Europe/Zurich'), (timestamp '2025-06-09 17:30' at time zone 'Europe/Zurich'), 554, 556.40, 0, 'Lopperhafen → Postune', null, 28, null, import_user_id),
    (target_boat_id, (timestamp '2025-06-13 08:00' at time zone 'Europe/Zurich'), (timestamp '2025-06-13 20:30' at time zone 'Europe/Zurich'), 556.40, 557.50, 0, 'Lopperhafen → Postune', null, 28, null, import_user_id),
    (target_boat_id, (timestamp '2025-06-14 08:00' at time zone 'Europe/Zurich'), (timestamp '2025-06-14 15:00' at time zone 'Europe/Zurich'), 557.50, 558.40, 0, 'Lopperhafen → Postune', null, 30, null, import_user_id),
    (target_boat_id, (timestamp '2025-06-19 09:45' at time zone 'Europe/Zurich'), (timestamp '2025-06-19 17:45' at time zone 'Europe/Zurich'), 558.40, 559.70, 0, 'Lopperhafen → Postune', null, 30, null, import_user_id),
    (target_boat_id, (timestamp '2025-06-20 11:18' at time zone 'Europe/Zurich'), (timestamp '2025-06-20 21:25' at time zone 'Europe/Zurich'), 559.70, 560.60, 0, 'Lopperhafen → Postune', null, 32, null, import_user_id),
    (target_boat_id, (timestamp '2025-06-21 09:30' at time zone 'Europe/Zurich'), (timestamp '2025-06-21 19:00' at time zone 'Europe/Zurich'), 560.60, 561.80, 0, 'Lopperhafen → Postune', null, 32, null, import_user_id),
    (target_boat_id, (timestamp '2025-06-22 10:50' at time zone 'Europe/Zurich'), (timestamp '2025-06-22 15:30' at time zone 'Europe/Zurich'), 561.80, 563.10, 0, 'Lopperhafen → Postune', null, 32, null, import_user_id),
    (target_boat_id, (timestamp '2025-06-24 17:45' at time zone 'Europe/Zurich'), (timestamp '2025-06-24 20:00' at time zone 'Europe/Zurich'), 563.10, 563.90, 0, 'Lopperhafen → Postune', null, 28, null, import_user_id),
    (target_boat_id, (timestamp '2025-06-28 07:50' at time zone 'Europe/Zurich'), (timestamp '2025-06-28 15:40' at time zone 'Europe/Zurich'), 543.90, 564.70, 0, 'Lopperhafen → Postune', null, 28, null, import_user_id),
    (target_boat_id, (timestamp '2025-06-29 08:30' at time zone 'Europe/Zurich'), (timestamp '2025-06-29 19:40' at time zone 'Europe/Zurich'), 564.70, 566.20, 0, 'Lopperhafen → Postune', null, 30, null, import_user_id),
    (target_boat_id, (timestamp '2025-06-30 08:00' at time zone 'Europe/Zurich'), (timestamp '2025-06-30 08:45' at time zone 'Europe/Zurich'), 566.20, 566.40, 0, 'Lopperhafen → Tanken · Tanken / aund Decken', null, 24, null, import_user_id),
    (target_boat_id, (timestamp '2025-07-06 10:30' at time zone 'Europe/Zurich'), (timestamp '2025-07-06 20:40' at time zone 'Europe/Zurich'), 566.40, 567.50, 0, 'Lopperhafen → Postune', null, 30, null, import_user_id),
    (target_boat_id, (timestamp '2025-07-12 12:00' at time zone 'Europe/Zurich'), (timestamp '2025-07-12 16:00' at time zone 'Europe/Zurich'), 567.50, 568.50, 0, 'Lopperhafen → Horwer · windig und rauhe See', null, 27, null, import_user_id),
    (target_boat_id, (timestamp '2026-04-02 05:30' at time zone 'Europe/Zurich'), (timestamp '2026-04-02 06:30' at time zone 'Europe/Zurich'), 556.20, 557, 0, 'Einwassern Alpnach Stad', 'Bedeckt', 1, 8, import_user_id),
    (target_boat_id, (timestamp '2026-04-08 09:15' at time zone 'Europe/Zurich'), (timestamp '2026-04-08 11:19' at time zone 'Europe/Zurich'), 557.80, 558.90, 0, 'Horwer Chillen mit NOÉMIE', 'Sonnig / Klar', 10, 4, import_user_id),
    (target_boat_id, (timestamp '2026-04-17 23:15' at time zone 'Europe/Zurich'), (timestamp '2026-04-18 02:15' at time zone 'Europe/Zurich'), 587.90, 588.80, 1, 'Horwer', 'Teils bewölkt', 13, 7, import_user_id),
    (target_boat_id, (timestamp '2026-04-25 06:15' at time zone 'Europe/Zurich'), (timestamp '2026-04-25 10:00' at time zone 'Europe/Zurich'), 588.80, 590.10, 2, 'Horwer / Karl später Manu und Manuela', 'Sonnig / Klar', 10, 3, import_user_id),
    (target_boat_id, (timestamp '2026-04-26 12:30' at time zone 'Europe/Zurich'), (timestamp '2026-04-26 17:00' at time zone 'Europe/Zurich'), 590.10, 590.70, 1, 'Horwer Karl‘s', 'Bedeckt', 16, 9, import_user_id),
    (target_boat_id, (timestamp '2026-05-02 11:38' at time zone 'Europe/Zurich'), (timestamp '2026-05-02 17:15' at time zone 'Europe/Zurich'), 590.70, 591.80, 2, 'Horwer mit Karl‘s', 'Teils bewölkt', 17, 5, import_user_id),
    (target_boat_id, (timestamp '2026-05-24 11:39' at time zone 'Europe/Zurich'), (timestamp '2026-05-24 21:30' at time zone 'Europe/Zurich'), 593.80, 595.20, 2, 'Postune NOÉMIE und Dani // Karl‘s / Niederberger Philipp und Esti', 'Sonnig / Klar', 22, 5, import_user_id),
    (target_boat_id, (timestamp '2026-05-25 11:14' at time zone 'Europe/Zurich'), (timestamp '2026-05-25 20:30' at time zone 'Europe/Zurich'), 595.20, 596.70, 3, '', 'Sonnig / Klar', 23, 4, import_user_id),
    (target_boat_id, (timestamp '2026-05-26 17:37' at time zone 'Europe/Zurich'), (timestamp '2026-05-26 21:00' at time zone 'Europe/Zurich'), 596.70, 597.30, 2, 'Horwer Noemie Dani / Scheuber‘s', 'Überwiegend sonnig', 29, 9, import_user_id),
    (target_boat_id, (timestamp '2026-05-29 15:10' at time zone 'Europe/Zurich'), (timestamp '2026-05-29 22:30' at time zone 'Europe/Zurich'), 597.30, 599.20, 1, '', 'Sonnig / Klar', 27, 12, import_user_id),
    (target_boat_id, (timestamp '2026-06-20 09:30' at time zone 'Europe/Zurich'), (timestamp '2026-06-20 22:45' at time zone 'Europe/Zurich'), 599.20, 600.60, 1, 'Postune / Sarah / Karl‘s', 'Sonnig / Klar', 21, 3, import_user_id),
    (target_boat_id, (timestamp '2026-06-21 10:30' at time zone 'Europe/Zurich'), (timestamp '2026-06-21 17:39' at time zone 'Europe/Zurich'), 600.60, 602.10, 0, 'NOÉMIE und Dani / Daniela Karl Postune', 'Bedeckt', 25, 3, import_user_id),
    (target_boat_id, (timestamp '2026-06-23 14:00' at time zone 'Europe/Zurich'), (timestamp '2026-06-23 20:30' at time zone 'Europe/Zurich'), 602.10, 603.90, 2, 'Postune und Horwer // später NOÉMIE und Dani und Scheuber‘s zum Baden', 'Überwiegend sonnig', 32, 10, import_user_id),
    (target_boat_id, (timestamp '2026-06-24 13:30' at time zone 'Europe/Zurich'), (timestamp '2026-06-24 23:30' at time zone 'Europe/Zurich'), 603.90, 605.20, 2, 'Postune Scheuber‘s', 'Sonnig / Klar', 30, 6, import_user_id),
    (target_boat_id, (timestamp '2026-06-26 15:36' at time zone 'Europe/Zurich'), (timestamp '2026-06-26 23:45' at time zone 'Europe/Zurich'), 605.20, 606.80, 4, 'Postune mit Karl‘s', 'Sonnig / Klar', 33, 4, import_user_id),
    (target_boat_id, (timestamp '2026-06-27 10:36' at time zone 'Europe/Zurich'), (timestamp '2026-06-27 16:46' at time zone 'Europe/Zurich'), 606.80, 607.70, 1, 'Postune', 'Sonnig / Klar', 28, 3, import_user_id),
    (target_boat_id, (timestamp '2026-07-04 11:00' at time zone 'Europe/Zurich'), (timestamp '2026-07-05 10:34' at time zone 'Europe/Zurich'), 607.70, 609, 1, 'Postune Noemie Dani', 'Sonnig / Klar', 22, 7, import_user_id),
    (target_boat_id, (timestamp '2026-07-05 10:37' at time zone 'Europe/Zurich'), (timestamp '2026-07-05 17:56' at time zone 'Europe/Zurich'), 609, 610.70, 3, 'Sündenbucht NOÉMIE Dani', 'Sonnig / Klar', 23, 5, import_user_id),
    (target_boat_id, (timestamp '2026-07-08 13:11' at time zone 'Europe/Zurich'), (timestamp '2026-07-08 15:44' at time zone 'Europe/Zurich'), 610.70, 612, 0, '', 'Teils bewölkt', 28, 11, import_user_id),
    (target_boat_id, (timestamp '2026-07-09 08:19' at time zone 'Europe/Zurich'), (timestamp '2026-07-09 10:40' at time zone 'Europe/Zurich'), 612, 612.80, 0, 'Reparatur Wasserkreislauf / Alpnach Stad', 'Sonnig / Klar', 20, 2, import_user_id),
    (target_boat_id, (timestamp '2026-07-10 16:16' at time zone 'Europe/Zurich'), (timestamp '2026-07-10 22:34' at time zone 'Europe/Zurich'), 612.80, 614.10, 3, 'Postune mit Noemie Dani / Scheuber’s und Walti', 'Sonnig / Klar', 30, 10, import_user_id),
    (target_boat_id, (timestamp '2026-07-11 11:25' at time zone 'Europe/Zurich'), (timestamp '2026-07-11 21:08' at time zone 'Europe/Zurich'), 614.10, 615, 3, 'Postune Noemie Dani Scheubers Rolf Gang..', 'Bedeckt', 26, 5, import_user_id),
    (target_boat_id, (timestamp '2026-07-12 13:50' at time zone 'Europe/Zurich'), (timestamp '2026-07-12 22:00' at time zone 'Europe/Zurich'), 615, 616.40, 2, 'Horwer / später Scheuber mit Honegger‘s zum evening Apero', 'Sonnig / Klar', 27, 9, import_user_id),
    (target_boat_id, (timestamp '2026-07-13 16:30' at time zone 'Europe/Zurich'), (timestamp '2026-07-13 19:00' at time zone 'Europe/Zurich'), 616.40, 616.80, 0, 'Tanken und Baden im Horwer / Gedeckt', 'Bedeckt', 30, 7, import_user_id),
    (target_boat_id, (timestamp '2026-07-23 09:40' at time zone 'Europe/Zurich'), (timestamp '2026-07-23 17:35' at time zone 'Europe/Zurich'), 616.80, 620.10, 0, 'Sarah // Essen Schwybogen / Beckenried angelegt', 'Bedeckt', 17, 5, import_user_id),
    (target_boat_id, (timestamp '2026-07-28 11:15' at time zone 'Europe/Zurich'), (timestamp '2026-07-28 19:14' at time zone 'Europe/Zurich'), 620.10, 621.90, 1, 'NOÉMIE', 'Sonnig / Klar', 22, 5, import_user_id),
    (target_boat_id, (timestamp '2026-07-30 14:08' at time zone 'Europe/Zurich'), (timestamp '2026-07-30 17:16' at time zone 'Europe/Zurich'), 623.70, 624.50, 2, 'NOÉMIE Walti / Sündenbucht Sturmwarnung Wind', 'Sonnig / Klar', 34, 7, import_user_id),
    (target_boat_id, (timestamp '2026-07-30 14:08' at time zone 'Europe/Zurich'), (timestamp '2026-08-03 17:22' at time zone 'Europe/Zurich'), 624.50, 625.40, 0, 'Horwer NOÉMIE', 'Sonnig / Klar', 34, 7, import_user_id),
    (target_boat_id, (timestamp '2026-08-07 12:56' at time zone 'Europe/Zurich'), (timestamp '2026-08-07 20:53' at time zone 'Europe/Zurich'), 625.40, 626.90, 4, 'Postune Noemie und Dani mit Karl‘s', 'Überwiegend sonnig', 23, 9, import_user_id),
    (target_boat_id, (timestamp '2026-08-07 12:56' at time zone 'Europe/Zurich'), (timestamp '2026-08-08 20:55' at time zone 'Europe/Zurich'), 626.90, 628.40, 3, 'Noemie Dani', 'Überwiegend sonnig', 23, 9, import_user_id),
    (target_boat_id, (timestamp '2026-08-07 12:56' at time zone 'Europe/Zurich'), (timestamp '2026-08-09 14:46' at time zone 'Europe/Zurich'), 628.40, 629.30, 2, 'Sarah // Apero mit Karls bei Philipp und Esti', 'Überwiegend sonnig', 23, 9, import_user_id),
    (target_boat_id, (timestamp '2026-08-07 12:56' at time zone 'Europe/Zurich'), (timestamp '2026-08-12 22:34' at time zone 'Europe/Zurich'), 629.30, 630.70, 1, 'NOÉMIE Dani / Sonnenfinsternis // Luzerner Bucht', 'Überwiegend sonnig', 23, 9, import_user_id),
    (target_boat_id, (timestamp '2026-08-13 12:36' at time zone 'Europe/Zurich'), (timestamp '2026-08-13 17:57' at time zone 'Europe/Zurich'), 630.70, 631.60, 0, '', 'Sonnig / Klar', 27, 5, import_user_id),
    (target_boat_id, (timestamp '2026-08-14 10:04' at time zone 'Europe/Zurich'), (timestamp '2026-08-14 21:59' at time zone 'Europe/Zurich'), 631.60, 633.60, 3, 'Obermatt Postune // Starker Wind', 'Sonnig / Klar', 24, 3, import_user_id),
    (target_boat_id, (timestamp '2026-08-15 10:21' at time zone 'Europe/Zurich'), (timestamp '2026-08-15 14:56' at time zone 'Europe/Zurich'), 633.60, 634.40, 0, 'Sündenbucht', 'Sonnig / Klar', 25, 2, import_user_id),
    (target_boat_id, (timestamp '2026-08-15 10:21' at time zone 'Europe/Zurich'), (timestamp '2026-08-16 15:22' at time zone 'Europe/Zurich'), 634.40, 635.40, 2, 'Horwer Noemie und Dani / Scheuber', 'Sonnig / Klar', 25, 2, import_user_id),
    (target_boat_id, (timestamp '2026-08-15 10:21' at time zone 'Europe/Zurich'), (timestamp '2026-08-19 20:26' at time zone 'Europe/Zurich'), 635.40, 637.20, 1, 'Sündenbucht mit Georgy', 'Sonnig / Klar', 25, 2, import_user_id),
    (target_boat_id, (timestamp '2026-08-26 16:31' at time zone 'Europe/Zurich'), (timestamp '2026-08-26 18:58' at time zone 'Europe/Zurich'), 637.20, 638.10, 0, 'Horwer mit Sarah', 'Teils bewölkt', 26, 5, import_user_id),
    (target_boat_id, (timestamp '2026-08-27 15:15' at time zone 'Europe/Zurich'), (timestamp '2026-08-27 19:47' at time zone 'Europe/Zurich'), 638.10, 639.40, 1, 'Spndenbucht mit Wyrsch', 'Bedeckt', 27, 4, import_user_id),
    (target_boat_id, (timestamp '2026-08-30 09:34' at time zone 'Europe/Zurich'), (timestamp '2026-08-30 20:01' at time zone 'Europe/Zurich'), 639.40, 640.70, 2, 'Postune', 'Sonnig / Klar', 19, 4, import_user_id),
    (target_boat_id, (timestamp '2026-09-06 09:08' at time zone 'Europe/Zurich'), (timestamp '2026-09-06 18:33' at time zone 'Europe/Zurich'), 640.70, 642.50, 3, 'Postune Noemie und Dani', 'Teils bewölkt', 17, 4, import_user_id),
    (target_boat_id, (timestamp '2026-09-15 10:38' at time zone 'Europe/Zurich'), (timestamp '2026-09-15 17:41' at time zone 'Europe/Zurich'), 642.50, 645.10, 0, '', 'Sonnig / Klar', 17, 2, import_user_id),
    (target_boat_id, (timestamp '2026-09-20 11:19' at time zone 'Europe/Zurich'), (timestamp '2026-09-20 16:19' at time zone 'Europe/Zurich'), 645.10, 646.30, 2, 'Horwer Season End /', 'Sonnig / Klar', 18, 3, import_user_id),
    (target_boat_id, (timestamp '2026-09-29 12:00' at time zone 'Europe/Zurich'), (timestamp '2026-09-29 14:00' at time zone 'Europe/Zurich'), 646.30, 647.70, 0, 'Auswassern', 'Überwiegend sonnig', 21, 5, import_user_id);

  insert into public.costs (
    boat_id, cost_date, category, description, amount_chf, litres, price_per_litre, created_by
  )
  values
    (target_boat_id, date '2025-01-06', 'Unterhalt'::public.cost_category, 'Marine Service Halter – Service', 800.20, null, null, import_user_id),
    (target_boat_id, date '2025-01-10', 'Bootsplatz'::public.cost_category, 'Gemeinde Hergiswil – Miete Bootsplatz Kategorie C6 Pla', 2480, null, null, import_user_id),
    (target_boat_id, date '2025-01-10', 'Bootsplatz'::public.cost_category, 'Gemeinde Hergiswil – Elektroanschluss (pauschel)', 150, null, null, import_user_id),
    (target_boat_id, date '2025-04-07', 'Unterhalt'::public.cost_category, 'Marine Service Halter – Einwassern', 743.75, null, null, import_user_id),
    (target_boat_id, date '2025-04-11', 'Steuern'::public.cost_category, 'VSZ Verkehrssicherheitszentrum NW – Wasswerfahrzeugsteuer 844.- / Jahr Crownline CR 280', 844, null, null, import_user_id),
    (target_boat_id, date '2025-06-19', 'Treibstoff'::public.cost_category, 'Treibstoff', 242.25, 136, 1.78, import_user_id),
    (target_boat_id, date '2025-06-30', 'Treibstoff'::public.cost_category, 'Treibstoff', 261.30, 146.79, 1.78, import_user_id),
    (target_boat_id, date '2025-10-07', 'Unterhalt'::public.cost_category, 'Marine Service Halter – Winterlager / Auswassern', 3269.45, null, null, import_user_id),
    (target_boat_id, date '2025-12-22', 'Unterhalt'::public.cost_category, 'Marine Service Halter – Service / Z-Reparatur', 1387.20, null, null, import_user_id),
    (target_boat_id, date '2026-05-23', 'Treibstoff'::public.cost_category, 'Treibstoff', 283.36, 154, 1.84, import_user_id),
    (target_boat_id, date '2026-06-24', 'Treibstoff'::public.cost_category, 'Treibstoff', 298.80, 166, 1.80, import_user_id),
    (target_boat_id, date '2026-07-13', 'Treibstoff'::public.cost_category, 'Treibstoff', 283.36, 161, 1.76, import_user_id),
    (target_boat_id, date '2026-07-29', 'Treibstoff'::public.cost_category, 'Treibstoff', 255.36, 133, 1.92, import_user_id),
    (target_boat_id, date '2026-09-29', 'Treibstoff'::public.cost_category, 'Treibstoff', 244.53, 117, 2.09, import_user_id);

  raise notice 'Import abgeschlossen: 63 Ausflüge und 14 Kosten.';
end $$;

commit;
