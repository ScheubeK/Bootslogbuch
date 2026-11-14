const SHEET_NAME = "Logbuch";
const COST_SHEET_NAME = "Kosten";
const BOAT_NAME_PROPERTY = "BOAT_NAME";
const LOG_HEADERS = ["ID", "Start", "Ende", "Motor Start", "Motor Ende", "Getankt", "Liter", "Preis/L", "Wein", "Bemerkungen", "Wetter", "Temp", "Wind"];
const COST_HEADERS = ["ID", "Datum", "Kategorie", "Beschreibung", "Betrag (CHF)", "Liter", "Preis/Liter"];
const COST_CATEGORIES = ["Benzin", "Versicherungen", "Steuern", "Bootsplatz", "Unterhalt"];

// Bindet eine HTML-Teil-Datei unverändert in Index.html ein.
// Damit kann dieselbe reine Client-Logik lokal getestet und in der Web-App verwendet werden.
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function doGet() {
  setupSheet();
  setupCostsSheet();
  const output = HtmlService.createTemplateFromFile("Index").evaluate();
  output.setTitle("Bootslogbuch");
  output.addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no");
  return output;
}

function getBoatName() {
  return PropertiesService.getScriptProperties().getProperty(BOAT_NAME_PROPERTY) || "";
}

function saveBoatName(name) {
  const boatName = String(name || "").trim().slice(0, 60);
  const properties = PropertiesService.getScriptProperties();
  if (boatName) {
    properties.setProperty(BOAT_NAME_PROPERTY, boatName);
  } else {
    properties.deleteProperty(BOAT_NAME_PROPERTY);
  }
  return boatName;
}

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(LOG_HEADERS);
    sheet.getRange("A1:M1").setFontWeight("bold").setBackground("#e0e0e0");
  }
}

function getLastEngineHours() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;
  const val = sheet.getRange(lastRow, 5).getValue();
  return isNaN(val) ? 0 : val;
}

// Hilfsfunktion: Wandelt Open-Meteo Wetter-Codes in deutschen Text um
function getWeatherDesc(code) {
  if (code === 0) return "Sonnig / Klar";
  if (code === 1) return "Überwiegend sonnig";
  if (code === 2) return "Teils bewölkt";
  if (code === 3) return "Bedeckt";
  if (code === 45 || code === 48) return "Nebel";
  if (code >= 51 && code <= 57) return "Nieselregen";
  if (code >= 61 && code <= 67) return "Regen";
  if (code >= 71 && code <= 77) return "Schneefall";
  if (code >= 80 && code <= 82) return "Regenschauer";
  if (code >= 85 && code <= 86) return "Schneeschauer";
  if (code >= 95) return "Gewitter";
  return "Unbekannt";
}

function saveOrUpdateEntry(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  const isNew = !data.id;

  let wetter = "";
  let temp = "";
  let wind = "";

  // NEU: Wetter wird jetzt IMMER für das angegebene Startdatum/Uhrzeit abrufen
  // Egal ob neuer Eintrag oder Update
  if (data.startDateTime) {
    try {
      const datePart = data.startDateTime.split("T")[0]; // "2024-06-15"
      const hourPart = parseInt(data.startDateTime.split("T")[1].split(":")[0]); // 14

      const url = `https://api.open-meteo.com/v1/forecast?latitude=46.9833&longitude=8.3000&start_date=${datePart}&end_date=${datePart}&hourly=temperature_2m,windspeed_10m,weathercode&timezone=Europe%2FZurich`;

      const res = UrlFetchApp.fetch(url);
      const wData = JSON.parse(res.getContentText());

      temp = Math.round(wData.hourly.temperature_2m[hourPart]);
      wind = Math.round(wData.hourly.windspeed_10m[hourPart]);
      wetter = getWeatherDesc(wData.hourly.weathercode[hourPart]);

    } catch(e) {
      console.log("Wetterfehler: " + e.message);
      // Falls das Abrufen fehlschlägt (z.B. kein Internet), versuchen wir bei einem Update
      // die alten Wetterdaten zu behalten, damit sie nicht gelöscht werden.
      if (!isNew) {
        for (let i = 1; i < values.length; i++) {
          if (values[i][0].toString() === data.id.toString()) {
            wetter = values[i][10] || "";
            temp = values[i][11] || "";
            wind = values[i][12] || "";
            break;
          }
        }
      }
    }
  }

  const rowData = [
    data.id || new Date().getTime().toString(),
    data.startDateTime,
    data.endDateTime,
    Number(data.motorStart),
    Number(data.motorEnd),
    "Nein",
    0,
    0,
    Number(data.wine) || 0,
    data.remarks,
    wetter,
    temp,
    wind
  ];

  if (!isNew) {
    for (let i = 1; i < values.length; i++) {
      if (values[i][0].toString() === data.id.toString()) {
        sheet.getRange(i + 1, 1, 1, 13).setValues([rowData]);
        return "aktualisiert";
      }
    }
  }
  sheet.appendRow(rowData);
  return "gespeichert";
}

function getLogData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Logbuch");
  const data = sheet.getDataRange().getValues();
  const timezone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

  // Wir überspringen die Kopfzeile und formatieren die Daten
  return data.slice(1).map(row => {
    // Spalte 1 (Start) und Spalte 2 (Ende) sind Datumsfelder
    // Wir formatieren sie hier direkt als String "YYYY-MM-DDTHH:mm"
    if (row[1] instanceof Date) {
      row[1] = Utilities.formatDate(row[1], timezone, "yyyy-MM-dd'T'HH:mm");
    }
    if (row[2] instanceof Date) {
      row[2] = Utilities.formatDate(row[2], timezone, "yyyy-MM-dd'T'HH:mm");
    }
    return row;
  });
}

function deleteEntry(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === id.toString()) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function resetSheet(sheetName, headers, headerRange) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(headerRange).setFontWeight("bold").setBackground("#e0e0e0");
  sheet.setFrozenRows(1);
}

function resetAllData() {
  resetSheet(SHEET_NAME, LOG_HEADERS, "A1:M1");
  resetSheet(COST_SHEET_NAME, COST_HEADERS, "A1:G1");
  return true;
}

// Kompatibilität für vorhandene lokale Aufrufe.
function resetLogbook() {
  return resetAllData();
}

function csvEscape(value) {
  const text = value instanceof Date
    ? Utilities.formatDate(value, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm")
    : String(value == null ? "" : value);
  return '"' + text.replace(/"/g, '""') + '"';
}

function toCsv(rows) {
  return "\uFEFF" + rows.map(row => row.map(csvEscape).join(",")).join("\n");
}

function getCsvData() {
  setupSheet();
  setupCostsSheet();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    logbook: toCsv(ss.getSheetByName(SHEET_NAME).getDataRange().getValues()),
    costs: toCsv(ss.getSheetByName(COST_SHEET_NAME).getDataRange().getValues())
  };
}

function formatSheetDate(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "yyyy-MM-dd");
  }
  return String(value || "").slice(0, 10);
}

function getCostData() {
  setupCostsSheet();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(COST_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  return data.slice(1).map(row => {
    row[1] = formatSheetDate(row[1]);
    return row;
  });
}

function saveOrUpdateCost(data) {
  setupCostsSheet();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date || "")) {
    throw new Error("Bitte ein gültiges Datum angeben.");
  }
  if (!COST_CATEGORIES.includes(data.category)) {
    throw new Error("Bitte eine gültige Kostenkategorie wählen.");
  }

  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Bitte einen gültigen Betrag angeben.");
  }

  const liters = data.liters === "" || data.liters === undefined ? "" : Number(data.liters);
  const pricePerLiter = data.pricePerLiter === "" || data.pricePerLiter === undefined ? "" : Number(data.pricePerLiter);
  if ((liters !== "" && (!Number.isFinite(liters) || liters < 0)) ||
      (pricePerLiter !== "" && (!Number.isFinite(pricePerLiter) || pricePerLiter < 0))) {
    throw new Error("Liter und Preis/Liter müssen positive Zahlen sein.");
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(COST_SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  const id = data.id || new Date().getTime().toString();
  const rowData = [
    id,
    data.date,
    data.category,
    String(data.description || "").trim(),
    amount,
    data.category === "Benzin" ? liters : "",
    data.category === "Benzin" ? pricePerLiter : ""
  ];

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sheet.getRange(i + 1, 1, 1, COST_HEADERS.length).setValues([rowData]);
      return "aktualisiert";
    }
  }

  sheet.appendRow(rowData);
  return "gespeichert";
}

function deleteCost(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(COST_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function getAvailableYears() {
  const years = new Set([String(new Date().getFullYear())]);
  getLogData().forEach(row => {
    const year = String(row[1] || "").slice(0, 4);
    if (/^\d{4}$/.test(year)) years.add(year);
  });
  getCostData().forEach(row => {
    const year = String(row[1] || "").slice(0, 4);
    if (/^\d{4}$/.test(year)) years.add(year);
  });
  return Array.from(years).sort((a, b) => Number(b) - Number(a));
}

// Speichert die Startzeit serverseitig bei Google
function setServerStartTime(time) {
  PropertiesService.getScriptProperties().setProperty('ACTIVE_TRIP_START', time);
}

// Holt die gespeicherte Startzeit ab
function getServerStartTime() {
  return PropertiesService.getScriptProperties().getProperty('ACTIVE_TRIP_START');
}

// Löscht die Startzeit (wenn der Ausflug beendet ist)
function clearServerStartTime() {
  PropertiesService.getScriptProperties().deleteProperty('ACTIVE_TRIP_START');
}

function setupCostsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(COST_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(COST_SHEET_NAME);
    sheet.appendRow(COST_HEADERS);
    sheet.getRange("A1:G1").setFontWeight("bold").setBackground("#e0e0e0");
    sheet.setFrozenRows(1);
  }
}
