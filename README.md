# Bootslogbuch Cloud

Dies ist der Branch `cloudflare-supabase` der neuen, mehrbenutzerfähigen
Bootslogbuch-App. Die produktive Google-Apps-Script-Version bleibt unverändert
auf dem Branch [`apps-script`](https://github.com/ScheubeK/Bootslogbuch/tree/apps-script).

## Architektur

- **Cloudflare Pages** liefert die statische Web-App aus `web/` aus.
- **Cloudflare Pages Functions** stellt unter `/api/config` die öffentliche
  Supabase-Browserkonfiguration bereit.
- **Supabase Auth** meldet Personen primär über Google und optional per Magic
  Link an.
- **Supabase PostgreSQL** speichert Boote, Crew, Ausflüge und Kosten.
- **Supabase Row Level Security** erlaubt Zugriff ausschließlich auf die Boote,
  deren Crew ein Benutzer angehört.

Der Supabase-Anon-Key ist für Browser-Anwendungen vorgesehen; die Sicherheit
der Daten kommt aus den Datenbankregeln. Der `service_role`-Key darf weder in
Cloudflare Pages noch im Browser noch in Git gespeichert werden.

## Datenbank einrichten

Die SQL-Dateien unter `supabase/migrations/` werden in dieser Reihenfolge im
Supabase **SQL Editor** ausgeführt:

1. `202611170001_initial_schema.sql`
2. `202611170002_protect_boat_owners.sql`
3. `202611170003_active_trips.sql`
4. `202611170004_boat_weather_location.sql`
5. `202611170005_reset_boat_data.sql`
6. `202611170006_import_boat_backup.sql`
7. `202611180001_rename_benzin_to_treibstoff.sql`

Die erste Migration enthält Tabellen, Auth-Profile, Rollen, Einladungen und
Row-Level-Security. Die zweite verhindert, dass ein Kapitän seine einzige
Owner-Rolle versehentlich löscht. Die dritte speichert den Startzeitpunkt eines
laufenden Ausflugs separat, damit er nach iPhone-Sleep oder einem Neustart der
App erhalten bleibt.

Der Wetterort eines Boots ist standardmässig **Hergiswil NW, Schweiz**. Der
Kapitän kann ihn in den Settings ändern; neue Ausflüge übernehmen Wetter,
Temperatur und Wind automatisch von Open-Meteo. Es wird kein API-Schlüssel
benötigt.

## Anmeldung konfigurieren

### Google Login (empfohlen)

1. In der [Google Cloud Console](https://console.cloud.google.com/) ein Projekt
   anlegen oder auswählen und unter **APIs & Services → OAuth consent screen**
   eine externe OAuth-App einrichten. Solange sie im Testmodus ist, die E-Mail-
   Adressen der Testpersonen als *Test users* hinzufügen.
2. Unter **Credentials → Create credentials → OAuth client ID** den Typ
   **Web application** wählen.
3. Bei **Authorized redirect URIs** exakt diese Adresse eintragen (Project Ref
   aus der Supabase-URL übernehmen):

   ```text
   https://DEIN-PROJECT-REF.supabase.co/auth/v1/callback
   ```

4. Client ID und Client Secret kopieren. In Supabase unter
   **Authentication → Providers → Google** Google aktivieren und beide Werte
   eintragen.

Crew-Mitglieder müssen sich mit dem Google-Konto anmelden, dessen E-Mail-
Adresse bei der Einladung verwendet wurde. Der Einladungsparameter bleibt
auch über die Google-Anmeldung erhalten.

### Magic Link (optionaler Fallback)

In Supabase unter **Authentication → Providers → Email** muss E-Mail aktiviert
sein. Für lokale Entwicklung wird als Site URL `http://localhost:5173` und als
Redirect URL `http://localhost:5173/**` verwendet.

Nach dem ersten Cloudflare-Deployment kommen zusätzlich diese Redirect URLs
hinzu:

```text
https://DEIN-PROJEKT.pages.dev/**
https://DEINE-EIGENE-DOMAIN/**
```

Die Standard-E-Mailzustellung von Supabase ist nur ein Fallback für erste
Tests. Vor einem öffentlichen Start sollte ein eigener SMTP-Anbieter (zum
Beispiel Resend) in Supabase hinterlegt werden, damit Magic Links zuverlässig
zugestellt werden.

## Cloudflare Pages bereitstellen

1. In Cloudflare **Workers & Pages → Create application → Pages → Connect to
   Git** wählen.
2. Das Repository `ScheubeK/Bootslogbuch` und den Branch
   `cloudflare-supabase` auswählen.
3. Framework: `None`; Build command: leer; Build output directory: `web`.
4. Unter **Settings → Environment variables** für Preview und Production
   setzen:

   | Variable | Wert |
   | --- | --- |
   | `SUPABASE_URL` | Project URL aus Supabase → Settings → API |
   | `SUPABASE_ANON_KEY` | Anon / Publishable Key aus Supabase → Settings → API |

5. Deploy auslösen und die neue `pages.dev`-URL in Supabase als Redirect URL
   hinzufügen.

Die Pages Function in `functions/api/config.js` liest diese Werte aus und
liefert sie an die Browser-App aus. Es werden keine geheimen Admin-Schlüssel
verwendet.

## Funktionsumfang der ersten Cloud-Version

- Google-Anmeldung und optionale Magic-Link-Anmeldung
- mehrere Boote pro Benutzer
- Crew-Rollen `Owner` und `Crew`
- Ausflüge und Kosten erfassen, bearbeiten und löschen
- Jahresdashboard mit Kostenentwicklung
- fortsetzbarer Live-Ausflug mit serverseitig gespeichertem Startzeitpunkt
- frei wählbarer Wetterort und automatische Wetterdaten bei neuen Ausflügen
- Crew-Einladungen als sicherer Link zum Kopieren und Versenden
- Excel-Sicherung aller Ausflüge und Kosten in einer Datei mit zwei Tabs
- geschützter Excel-Import für den Kapitän

Der nächste Ausbau kann E-Mail-Versand für Crew-Einladungen, PDF-Exporte,
Wetterdaten und die Übernahme der bestehenden Apps-Script-Daten ergänzen.

## Testdaten und Testbenutzer bereinigen

Nach der Testphase kann ein einzelnes Test-Boot vollständig entfernt werden,
ohne andere Boote zu beeinflussen. Dabei werden **Datensätze** gelöscht, nicht
die Tabellenstruktur.

> Vorsicht: Dieser Vorgang ist nicht wiederherstellbar. Vorher bei Bedarf einen
> CSV-Export aus der App erstellen.

1. In Supabase **Table Editor → boats** öffnen und nach dem Namen des
   Test-Boots filtern.
2. Nur die betreffende Zeile des Test-Boots löschen. Nicht die Tabelle
   `boats` selbst löschen.
3. Durch die Datenbankbeziehungen werden automatisch auch Ausflüge, Kosten,
   aktive Ausflüge, Einladungen und Crew-Zugehörigkeiten dieses Boots entfernt.
4. Anschliessend unter **Authentication → Users** die reinen Testkonten
   löschen. Dies entfernt auch deren Profile.

Ein Testkonto darf nur gelöscht werden, wenn es nicht noch bei einem anderen
Boot mitarbeitet. Andernfalls würde dieser Login dort ebenfalls verschwinden.
Ein Benutzer, der das gelöschte Boot besass, lässt sich erst nach dem Löschen
dieses Boots entfernen.

Die App-Funktion **Settings → Alles löschen** entfernt lediglich Ausflüge und
Kosten eines Boots. Das Boot und sein Besitzerkonto bleiben dabei bestehen.

Für Google-Anmeldungen ist in der Google Cloud Console keine Bereinigung
nötig: Es wird nur das Supabase-Konto entfernt, nie das Google-Konto der
Person. Meldet sie sich später wieder an, entsteht ein neues Supabase-Konto
(solange Registrierungen erlaubt sind).
