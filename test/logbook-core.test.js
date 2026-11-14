const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadCore() {
  const file = path.join(__dirname, '..', 'LogbookCore.html');
  const html = fs.readFileSync(file, 'utf8');
  const context = { window: {} };
  vm.runInNewContext(`${html}\nthis.core = window.LogbookCore;`, context);
  return context.core;
}

const LogbookCore = loadCore();

test('berechnet die Dashboard-Kennzahlen aus gültigen und unvollständigen Fahrten', () => {
  const rows = [
    ['1', '2026-06-15T09:00', '2026-06-15T10:30', 100, 101.5, 2],
    ['2', '2026-06-16T12:00', '2026-06-16T12:30', '101.5', '102', '1'],
    ['3', 'ungültig', '2026-06-16T14:00', 'foo', 103, '']
  ];

  assert.deepEqual({ ...LogbookCore.calculateDashboard(rows) }, {
    trips: 3,
    engineHours: 105,
    wine: 3,
    seaTimeMilliseconds: 7200000,
    seaTimeHours: 2
  });
});

test('ignoriert negative und ungültige Zeitspannen für die Zeit auf See', () => {
  const rows = [
    ['1', '2026-06-15T10:00', '2026-06-15T09:00'],
    ['2', 'ungültig', '2026-06-15T09:00']
  ];

  const metrics = LogbookCore.calculateDashboard(rows);
  assert.equal(metrics.seaTimeMilliseconds, 0);
  assert.equal(metrics.seaTimeHours, 0);
});

test('formatiert eine Dauer für den PDF-Export', () => {
  assert.equal(LogbookCore.formatDuration(90 * 60 * 1000), '1h 30m');
  assert.equal(LogbookCore.formatDuration(-1), '0h 0m');
});

test('fasst Kosten nur in den erlaubten Kategorien zusammen', () => {
  const summary = LogbookCore.calculateCostSummary([
    ['1', '2026-06-01', 'Benzin', 'Tankstelle', 80.1, 45, 1.78],
    ['2', '2026-06-02', 'Unterhalt', 'Einwassern', 2010.44],
    ['3', '2026-06-03', 'Unbekannt', 'Ignorieren', 99]
  ]);

  assert.equal(summary.total, 2090.54);
  assert.equal(summary.byCategory.Benzin, 80.1);
  assert.equal(summary.byCategory.Unterhalt, 2010.44);
  assert.equal(summary.byCategory.Steuern, 0);
});

test('gruppiert Gesamtkosten nach Jahr und verarbeitet Komma-Dezimalwerte', () => {
  const totals = LogbookCore.calculateAnnualCostTotals([
    ['1', '2025-05-10', 'Benzin', 'Tankstelle', '80,10'],
    ['2', '2024-01-15', 'Bootsplatz', 'Jahresgebühr', '2\'174,00'],
    ['3', '2025-03-01', 'Unterhalt', 'Service', '99,90'],
    ['4', '2025-03-02', 'Unbekannt', 'Nicht zählen', '100,00']
  ]);

  assert.deepEqual(JSON.parse(JSON.stringify(totals)), [
    { year: '2024', total: 2174 },
    { year: '2025', total: 180 }
  ]);
});
