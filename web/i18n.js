/* global window, document, NodeFilter */
(function () {
  const english = {
    'Jede Fahrt festgehalten.': 'Every trip recorded.',
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
    'Sprache': 'Language', 'Deutsch': 'German', 'Englisch': 'English'
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
