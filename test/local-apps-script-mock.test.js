const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadLocalAdapter() {
  const storage = new Map();
  const window = {
    setTimeout(callback) { callback(); }
  };
  const document = {
    addEventListener() {},
    createElement() { return {}; },
    querySelector() { return { prepend() {} }; }
  };
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  };
  const context = { window, document, localStorage, console };
  const source = fs.readFileSync(path.join(__dirname, '..', 'LocalAppsScriptMock.js'), 'utf8');
  vm.runInNewContext(source, context);
  return window.google.script.run;
}

function call(runner, method, ...args) {
  return new Promise((resolve, reject) => {
    runner
      .withSuccessHandler(resolve)
      .withFailureHandler(reject)[method](...args);
  });
}

test('lokaler Apps-Script-Adapter speichert und lädt einen Eintrag', async () => {
  const runner = loadLocalAdapter();

  await call(runner, 'saveOrUpdateEntry', {
    startDateTime: '2026-06-15T09:00',
    endDateTime: '2026-06-15T10:00',
    motorStart: '10',
    motorEnd: '11',
    wine: '1',
    remarks: 'Lokaler Test'
  });

  const entries = await call(runner, 'getLogData');
  assert.equal(entries.length, 1);
  assert.equal(entries[0][5], 1);
  assert.equal(entries[0][6], 'Lokaler Test');
  assert.equal(entries[0][7], 'Lokaler Testmodus');
});

test('lokaler Apps-Script-Adapter speichert Kosten und liefert Kostenjahre', async () => {
  const runner = loadLocalAdapter();

  await call(runner, 'saveOrUpdateCost', {
    date: '2026-06-15',
    category: 'Benzin',
    description: 'Tankstelle',
    amount: '80.10',
    liters: '45',
    pricePerLiter: '1.78'
  });

  const costs = await call(runner, 'getCostData');
  const years = await call(runner, 'getAvailableYears');
  assert.equal(costs.length, 1);
  assert.equal(costs[0][2], 'Benzin');
  assert.equal(costs[0][4], 80.1);
  assert.equal(costs[0][5], 45);
  assert.ok(years.includes('2026'));
});

test('lokaler Apps-Script-Adapter speichert und entfernt den Bootsnamen', async () => {
  const runner = loadLocalAdapter();

  assert.equal(await call(runner, 'saveBoatName', '  Seestern  '), 'Seestern');
  assert.equal(await call(runner, 'getBoatName'), 'Seestern');
  assert.equal(await call(runner, 'saveBoatName', ''), '');
  assert.equal(await call(runner, 'getBoatName'), '');
});

test('lokaler Apps-Script-Adapter löscht Logbuch und Kosten gemeinsam und exportiert beides', async () => {
  const runner = loadLocalAdapter();

  await call(runner, 'saveOrUpdateEntry', {
    startDateTime: '2026-06-15T09:00', endDateTime: '2026-06-15T10:00',
    motorStart: '10', motorEnd: '11', wine: '0', remarks: 'Ausflug'
  });
  await call(runner, 'saveOrUpdateCost', {
    date: '2026-06-15', category: 'Unterhalt', description: 'Service', amount: '120'
  });

  const csv = await call(runner, 'getCsvData');
  assert.match(csv.logbook, /Ausflug/);
  assert.match(csv.costs, /Service/);

  await call(runner, 'resetAllData');
  assert.equal((await call(runner, 'getLogData')).length, 0);
  assert.equal((await call(runner, 'getCostData')).length, 0);
});
