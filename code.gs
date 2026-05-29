const SHEET_NAME = "Logbuch";

function doGet() {
  setupSheet();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Bootslogbuch')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const headers = ["ID", "Start", "Ende", "Motor Start", "Motor Ende", "Getankt", "Liter", "Preis/L", "Wein", "Bemerkungen", "Wetter", "Temp", "Wind"];
    sheet.appendRow(headers);
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
    data.refueled ? "Ja" : "Nein",
    Number(data.liters) || 0,
    Number(data.pricePerLiter) || 0,
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

function resetLogbook() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet) {
    sheet.clear();
    const headers = ["ID", "Start", "Ende", "Motor Start", "Motor Ende", "Getankt", "Liter", "Preis/L", "Wein", "Bemerkungen", "Wetter", "Temp", "Wind"];
    sheet.appendRow(headers);
  }
  return true;
}

function getCsvData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  return data.map(row => row.join(",")).join("\n");
}

// =============================================
// KOSTEN-MODUL
// =============================================
const COST_SHEET_NAME = "Kosten";

function setupCostSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(COST_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(COST_SHEET_NAME);
    const headers = ["ID", "Datum", "Kategorie", "Beschreibung", "Betrag", "Jahr"];
    sheet.appendRow(headers);
    sheet.getRange("A1:F1").setFontWeight("bold").setBackground("#e0e0e0");
  }
}

function saveCostEntry(data) {
  setupCostSheet();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(COST_SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  const isNew = !data.id;

  // Jahr aus dem Datum ableiten
  const jahr = data.datum ? data.datum.substring(0, 4) : new Date().getFullYear().toString();

  const rowData = [
    data.id || new Date().getTime().toString(),
    data.datum,
    data.kategorie,
    data.beschreibung,
    Number(data.betrag) || 0,
    jahr
  ];

  if (!isNew) {
    for (let i = 1; i < values.length; i++) {
      if (values[i][0].toString() === data.id.toString()) {
        sheet.getRange(i + 1, 1, 1, 6).setValues([rowData]);
        return "aktualisiert";
      }
    }
  }
  sheet.appendRow(rowData);
  return "gespeichert";
}

function getCostData() {
  setupCostSheet();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(COST_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const timezone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

  return data.slice(1).map(row => {
    if (row[1] instanceof Date) {
      row[1] = Utilities.formatDate(row[1], timezone, "yyyy-MM-dd");
    }
    return row;
  });
}

function deleteCostEntry(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(COST_SHEET_NAME);
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === id.toString()) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function getCostSummary(year) {
  setupCostSheet();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(COST_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const targetYear = year || new Date().getFullYear().toString();

  const summary = { total: 0, byCategory: {} };

  for (let i = 1; i < data.length; i++) {
    const rowYear = data[i][5] ? data[i][5].toString() : "";
    if (rowYear === targetYear.toString()) {
      const betrag = parseFloat(data[i][4]) || 0;
      const kategorie = data[i][2] || "Sonstige";
      summary.total += betrag;
      summary.byCategory[kategorie] = (summary.byCategory[kategorie] || 0) + betrag;
    }
  }
  return summary;
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