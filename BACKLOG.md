# Produkt-Backlog

Noch nicht umgesetzte Ideen. Ein Eintrag in diesem Dokument bedeutet keine
Freigabe zur Umsetzung.

## Boote unterwegs

**Status:** Idee · noch nicht umgesetzt

### Ziel

Freiwillig sichtbarer Status für Boote mit einem laufenden Ausflug. Damit sehen
andere Bootslogbuch-Nutzer, dass ein Boot aktuell unterwegs ist – etwa als
Hinweis, dass bei Bedarf Hilfe erreichbar sein könnte.

### Vorgeschlagene Bedienung

- Der Kapitän aktiviert die bootübergreifende Sichtbarkeit ausdrücklich in den
  Settings; standardmässig bleibt das Boot unsichtbar.
- Auf dem Dashboard erscheint nur dann eine aufklappbare Karte
  **„Boote unterwegs · Anzahl“**, wenn mindestens ein Boot sichtbar unterwegs
  ist.
- Die Liste zeigt mindestens Bootsname und „unterwegs seit“. Der eigene
  laufende Ausflug wird weiterhin im Tab **Ausflüge** gesteuert.
- Eine spätere Ausbaustufe könnte einen freiwilligen Hilfehinweis oder
  Kontaktweg pro Boot erlauben.

### Grenzen und Datenschutz

- Die bestehende Tabelle `active_trips` liefert nur den Status und die
  Startzeit eines laufenden Ausflugs – **keine** GPS-Position, Route oder
  Echtzeitortung.
- Es ist keine Notfall- oder Sicherheitsüberwachung. Bei Gefahr gelten die
  offiziellen Notruf- und Seerettungswege.
- Für die Umsetzung wären neue Sichtbarkeitsregeln in Supabase, eine explizite
  Einwilligung des Kapitäns sowie eine Ergänzung der Datenschutzerklärung und
  Nutzungsbedingungen nötig.
