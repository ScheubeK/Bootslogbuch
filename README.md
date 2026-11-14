# Bootslogbuch

`code.gs` und `Index.html` bilden die Google-Apps-Script-Web-App für das
Bootslogbuch. Die Daten liegen in den Tabellenblättern `Logbuch` und `Kosten`
des gebundenen Google Sheets. Das Kostenblatt wird beim ersten Aufruf automatisch
erstellt.

## Kostenmodul

Kosten werden unabhängig von Fahrten erfasst und sind nach Jahr filterbar. Die
erlaubten Kategorien sind `Benzin`, `Versicherungen`, `Steuern`, `Bootsplatz`
und `Unterhalt`. Es gibt bewusst keine Budget- oder Importfunktion; das Modul
startet mit neuen Kostenposten. Die Benzin-Erfassung im Fahrtformular wird nicht
mehr verwendet.

Das Dashboard fasst das gewählte Jahr zusammen, inklusive Weinkonsum und
Kosten-Total. Ausflüge haben einen eigenen, ebenfalls nach Jahr filterbaren Tab
mit gut lesbaren Kommentar-Auszügen für die mobile Bedienung.

Unter **Setup** löscht `Logbuch löschen` sämtliche Fahrten und Kosten. Der
PDF-Bericht wird für ein ausgewähltes Jahr erzeugt und enthält die Fahrten sowie
die Kosten dieses Jahres. Der CSV-Export lädt dagegen alle Jahre als getrennte
CSV-Dateien für Logbuch und Kosten herunter.

## Lokale Kernlogik-Tests

Die Dashboard- und PDF-Berechnungen sind in `LogbookCore.html` von Browser- und
Google-Apps-Script-Diensten getrennt. Dadurch lassen sie sich ohne Deployment
lokal testen.

Voraussetzung ist Node.js 18 oder neuer. Es werden keine Paketabhängigkeiten
installiert. Im Repository ausführen:

```bash
npm test
```

Die Tests unter `test/` prüfen Logbuch- und Kostenkennzahlen, den lokalen
Apps-Script-Adapter sowie die Dauerformatierung.

## Lokale UI-Vorschau

Die lokale Vorschau startet ohne Node.js und ohne Google-Deployment. Sie nutzt
einen lokalen Ersatz für `google.script.run`; die Einträge werden ausschließlich
im Browser-Speicher abgelegt.

```bash
perl scripts/preview.pl
```

Danach `http://127.0.0.1:4173` im Browser öffnen. Im lokalen Modus lassen sich
Eingabe, Bearbeiten, Löschen, Dashboard, CSV- und PDF-Export testen. Das gelbe
Banner kennzeichnet den Modus eindeutig. Für einen leeren Teststand kann über
**Setup → Gesamtes Logbuch löschen** zurückgesetzt werden.

Nicht simuliert werden die echte Google-Sheet-Anbindung, Apps-Script-
Berechtigungen und der Open-Meteo-Abruf; statt Wetterdaten zeigt die Vorschau
Testwerte an.

## Manuelle Übernahme in Google Apps Script

Für einen Test in Google Apps Script müssen diese drei Dateien als
gleichnamige Dateien im Projekt liegen:

- `code.gs`
- `Index.html`
- `LogbookCore.html`

`code.gs` bindet die Teil-Datei ein; `Index.html` verwendet ihre Funktionen.
`LocalAppsScriptMock.js` und `scripts/preview.pl` werden nicht nach Google Apps
Script übertragen; sie dienen ausschließlich der lokalen Vorschau.
