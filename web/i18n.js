/* global window, document, NodeFilter */
(function () {
  const english = {
    'Jede Fahrt festgehalten.': 'Every trip recorded.',
    'Melde dich mit deinem Google-Konto an.': 'Sign in with your Google account.',
    'Melde dich mit deiner E-Mail-Adresse und deinem Passwort an.': 'Sign in with your email address and password.',
    'Erstelle hier dein Konto. Falls du eingeladen wurdest, verwende die E-Mail-Adresse deiner Crew-Einladung.': 'Create your account here. If you were invited, use the email address from your crew invitation.',
    'Informationen über Bootslogbuch sowie Datenschutz und Nutzungsbedingungen.': 'Information about Bootslogbuch, privacy and terms of service.',
    'Mit Google anmelden': 'Sign in with Google', 'oder': 'or', 'Mit E-Mail anmelden': 'Sign in with email',
    'E-Mail-Adresse': 'Email address', 'Passwort': 'Password', 'Anmelden': 'Sign in', 'Neu bei Bootslogbuch?': 'New to Bootslogbuch?',
    'Hier Konto einrichten': 'Create an account', 'Passwort einrichten / vergessen': 'Set / reset password', 'Zurück zur Anmeldung': 'Back to sign in',
    'About & Rechtliches': 'About & legal', 'Bedienungsanleitung': 'User guide', 'About Bootslogbuch': 'About Bootslogbuch',
    'Datenschutz': 'Privacy', 'Datenschutzerklärung': 'Privacy policy', 'Nutzungsbedingungen': 'Terms of service',
    'Willkommen an Bord': 'Welcome aboard', 'Bootsname': 'Boat name', 'Boot anlegen': 'Create boat',
    'Ausflüge': 'Trips', 'Dashboard': 'Dashboard', 'Kosten': 'Costs', 'Settings': 'Settings', 'Ausflug erfassen': 'Add trip',
    'Jahresübersicht': 'Annual overview', 'Saisonrückblick': 'Season review', 'Ansehen': 'View', 'Kosten nach Kategorie': 'Costs by category',
    'Kostenentwicklung': 'Cost trend', 'Alle Jahre': 'All years', 'Live-Tracking': 'Live tracking', 'Bereit zum Ablegen…': 'Ready to depart…',
    'Ausflug starten': 'Start trip', 'Neue Ausgabe erfassen': 'Add expense', 'Übersicht': 'Overview', 'Kosten teilen': 'Split costs',
    'Start': 'Start', 'Ende': 'End', 'Motor Start': 'Engine start', 'Motor Ende': 'Engine end', 'Wetter': 'Weather',
    'Lufttemperatur °C': 'Air temperature °C', 'Wind km/h': 'Wind km/h', 'Wassertemperatur °C': 'Water temperature °C',
    'Bemerkungen': 'Notes', 'Speichern': 'Save', 'Abbrechen': 'Cancel', 'Schliessen': 'Close', 'Bearbeiten': 'Edit', 'Löschen': 'Delete',
    'Datum': 'Date', 'Kategorie': 'Category', 'Beschreibung': 'Description', 'Betrag (CHF)': 'Amount (CHF)',
    'Liter': 'Litres', 'Preis/Liter': 'Price/litre', 'Diese Kosten teilen': 'Split this cost', 'Bezahlt von': 'Paid by',
    'Beteiligt an diesen Kosten': 'Included in this cost', 'Kostenbeteiligte': 'Cost participants', 'Saldo': 'Balance',
    'Vorgeschlagener Ausgleich': 'Suggested settlement', 'Ausgleich buchen': 'Record settlement', 'Ausgleichszahlungen': 'Settlements',
    'Von': 'From', 'An': 'To', 'Crew': 'Crew', 'Crew einladen': 'Invite crew', 'Einladen': 'Invite', 'Entfernen': 'Remove',
    'Wetterort & See': 'Weather location & lake', 'Wetterort': 'Weather location', 'See für Wassertemperatur': 'Lake for water temperature',
    'Dashboard anpassen': 'Customize dashboard', 'Standard': 'Default', 'Daten Export & Import': 'Data export & import',
    'Excel-Sicherung herunterladen': 'Download Excel backup', 'Excel-Sicherung importieren': 'Import Excel backup', 'Daten löschen': 'Delete data',
    'Kapitän': 'Captain', 'Treibstoff': 'Fuel', 'Versicherungen': 'Insurance', 'Steuern': 'Taxes', 'Bootsplatz': 'Mooring', 'Unterhalt': 'Maintenance',
    'Ausflüge filtern': 'Filter trips', 'Zurücksetzen': 'Reset', 'Alle Wetter': 'All weather', 'Details': 'Details',
    'Ausflug läuft…': 'Trip in progress…', 'Ausflug beenden und speichern…': 'Finish and save trip…',
    'Kosten Total': 'Total costs', 'Motorstunden': 'Engine hours', 'Zeit auf See': 'Time on water', 'Weinkonsum': 'Wine consumption',
    'Treibstoffverbrauch': 'Fuel consumption', 'Ø Ausflugsdauer': 'Average trip duration', 'Highlights': 'Highlights',
    'Erste Fahrt': 'First trip', 'Letzte Fahrt': 'Last trip', 'Längster Ausflug': 'Longest trip', 'Wärmstes Wasser': 'Warmest water',
    'Kältestes Wasser': 'Coldest water', 'Wärmster Tag': 'Warmest day', 'Stärkster Wind': 'Strongest wind',
    'Kosten / Motorstunde': 'Costs / engine hour', 'Kosten / Ausflug': 'Costs / trip', 'Treibstoff verbraucht': 'Fuel used',
    'Treibstoff / Motorstunde': 'Fuel / engine hour', 'Kosten / Seestunde': 'Costs / hour on water',
    'Für neue Ausflüge werden Wetterdaten und die Wassertemperatur automatisch übernommen.': 'Weather data and water temperature are automatically suggested for new trips.',
    'Exportiert alle Ausflüge, Kosten und – falls verwendet – die Kostenaufteilung dieses Boots in eine Excel-Datei. Ein Import fügt die enthaltenen Daten diesem Boot hinzu.': 'Exports all trips, costs and, if used, cost sharing for this boat to an Excel file. An import adds the included data to this boat.',
    'Löscht Ausflüge, Kosten und Ausgleichszahlungen eines Jahres oder des ganzen Boots. Boot, Crew, Kostenbeteiligte und Wetterort bleiben bestehen.': 'Deletes trips, costs and settlements for one year or the entire boat. The boat, crew, cost participants and weather location remain.',
    'Für neue Ausflüge werden Wetter, Temperatur und Wind automatisch übernommen.': 'Weather, temperature and wind are automatically suggested for new trips.',
    'Crewmitglied': 'Crew member', 'Offene Einladungen': 'Open invitations', 'Einladungslink kopieren': 'Copy invitation link', 'Zurückziehen': 'Revoke',
    'Sprache': 'Language', 'Deutsch': 'German', 'Englisch': 'English', 'name@beispiel.ch': 'name@example.com'
  };
  const attributes = ['placeholder', 'aria-label', 'title'];
  function translated(value, locale) {
    if (locale !== 'en') return value;
    const leading = value.match(/^\s*/)[0]; const trailing = value.match(/\s*$/)[0];
    const core = value.trim();
    return Object.prototype.hasOwnProperty.call(english, core) ? `${leading}${english[core]}${trailing}` : value;
  }
  function localize(root, locale) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => { if (!node.parentElement || ['SCRIPT', 'STYLE'].includes(node.parentElement.tagName)) return; node.__bootslogbuchGerman ??= node.nodeValue; node.nodeValue = translated(node.__bootslogbuchGerman, locale); });
    root.querySelectorAll?.('*').forEach(element => attributes.forEach(attribute => {
      if (!element.hasAttribute(attribute)) return;
      element.__bootslogbuchGermanAttributes ??= {};
      element.__bootslogbuchGermanAttributes[attribute] ??= element.getAttribute(attribute);
      element.setAttribute(attribute, translated(element.__bootslogbuchGermanAttributes[attribute], locale));
    }));
  }
  window.BootslogbuchI18n = { localize, english };
}());
