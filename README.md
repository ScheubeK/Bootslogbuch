# Bootslogbuch Cloud

Dies ist der Branch `cloudflare-supabase` der neuen, mehrbenutzerfähigen
Bootslogbuch-App. Die produktive Google-Apps-Script-Version bleibt unverändert
auf dem Branch [`apps-script`](https://github.com/ScheubeK/Bootslogbuch/tree/apps-script).

## Architektur

- **Cloudflare Pages** liefert die statische Web-App aus `web/` aus.
- **Cloudflare Pages Functions** stellt unter `/api/config` die öffentliche
  Supabase-Browserkonfiguration bereit.
- **Supabase Auth** meldet Personen per Magic Link an.
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

Die erste Migration enthält Tabellen, Auth-Profile, Rollen, Einladungen und
Row-Level-Security. Die zweite verhindert, dass ein Kapitän seine einzige
Owner-Rolle versehentlich löscht.

## Magic Link konfigurieren

In Supabase unter **Authentication → Providers → Email** muss E-Mail aktiviert
sein. Für lokale Entwicklung wird als Site URL `http://localhost:5173` und als
Redirect URL `http://localhost:5173/**` verwendet.

Nach dem ersten Cloudflare-Deployment kommen zusätzlich diese Redirect URLs
hinzu:

```text
https://DEIN-PROJEKT.pages.dev/**
https://DEINE-EIGENE-DOMAIN/**
```

Die Standard-E-Mailzustellung von Supabase reicht für erste Tests. Vor einem
öffentlichen Start sollte ein eigener SMTP-Anbieter (zum Beispiel Resend) in
Supabase hinterlegt werden, damit Login- und Einladungs-E-Mails zuverlässig
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

- Magic-Link-Anmeldung und selbstständige Bootserstellung für Kapitäne
- mehrere Boote pro Benutzer
- Crew-Rollen `Owner` und `Crew`
- Ausflüge und Kosten erfassen, bearbeiten und löschen
- Jahresdashboard mit Kostenentwicklung
- Crew-Einladungen als sicherer Link zum Kopieren und Versenden

Der nächste Ausbau kann E-Mail-Versand für Crew-Einladungen, PDF-/CSV-Exporte,
Wetterdaten und die Übernahme der bestehenden Apps-Script-Daten ergänzen.
