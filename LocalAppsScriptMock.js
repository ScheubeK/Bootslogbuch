// Lokaler Ersatz für google.script.run. Daten werden ausschließlich im
// Browser (localStorage) gespeichert und niemals zu Google übertragen.
(() => {
  if (window.google && window.google.script && window.google.script.run) return;

  const ENTRIES_KEY = 'bootslogbuch.local.entries.v1';
  const COSTS_KEY = 'bootslogbuch.local.costs.v1';
  const ACTIVE_TRIP_KEY = 'bootslogbuch.local.active-trip.v1';
  const BOAT_NAME_KEY = 'bootslogbuch.local.boat-name.v1';
  const LOG_HEADERS = ['ID', 'Start', 'Ende', 'Motor Start', 'Motor Ende', 'Getankt', 'Liter', 'Preis/L', 'Wein', 'Bemerkungen', 'Wetter', 'Temp', 'Wind'];
  const COST_HEADERS = ['ID', 'Datum', 'Kategorie', 'Beschreibung', 'Betrag (CHF)', 'Liter', 'Preis/Liter'];

  function readEntries() {
    try {
      const entries = JSON.parse(localStorage.getItem(ENTRIES_KEY) || '[]');
      return Array.isArray(entries) ? entries : [];
    } catch (_) {
      return [];
    }
  }

  function writeEntries(entries) {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  }

  function readCosts() {
    try {
      const costs = JSON.parse(localStorage.getItem(COSTS_KEY) || '[]');
      return Array.isArray(costs) ? costs : [];
    } catch (_) {
      return [];
    }
  }

  function writeCosts(costs) {
    localStorage.setItem(COSTS_KEY, JSON.stringify(costs));
  }

  function numberOrZero(value) {
    return Number(value) || 0;
  }

  function testWeather(startDateTime) {
    return startDateTime ? ['Lokaler Testmodus', 20, 10] : ['', '', ''];
  }

  const methods = {
    getBoatName() {
      return localStorage.getItem(BOAT_NAME_KEY) || '';
    },

    saveBoatName(name) {
      const boatName = String(name || '').trim().slice(0, 60);
      if (boatName) localStorage.setItem(BOAT_NAME_KEY, boatName);
      else localStorage.removeItem(BOAT_NAME_KEY);
      return boatName;
    },

    getLastEngineHours() {
      const entries = readEntries();
      return entries.length ? numberOrZero(entries[entries.length - 1][4]) : 0;
    },

    saveOrUpdateEntry(data) {
      const entries = readEntries();
      const weather = testWeather(data.startDateTime);
      const id = data.id || String(Date.now());
      const row = [
        id,
        data.startDateTime,
        data.endDateTime,
        Number(data.motorStart),
        Number(data.motorEnd),
        'Nein',
        0,
        0,
        numberOrZero(data.wine),
        data.remarks || '',
        weather[0],
        weather[1],
        weather[2]
      ];
      const index = entries.findIndex(entry => String(entry[0]) === String(id));
      if (index >= 0) {
        entries[index] = row;
        writeEntries(entries);
        return 'aktualisiert';
      }
      entries.push(row);
      writeEntries(entries);
      return 'gespeichert';
    },

    getLogData() {
      return readEntries();
    },

    deleteEntry(id) {
      const remaining = readEntries().filter(entry => String(entry[0]) !== String(id));
      writeEntries(remaining);
      return true;
    },

    resetAllData() {
      writeEntries([]);
      writeCosts([]);
      return true;
    },

    resetLogbook() {
      return this.resetAllData();
    },

    getCsvData() {
      const escape = value => '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
      const toCsv = rows => '\uFEFF' + rows.map(row => row.map(escape).join(',')).join('\n');
      return {
        logbook: toCsv([LOG_HEADERS, ...readEntries()]),
        costs: toCsv([COST_HEADERS, ...readCosts()])
      };
    },

    getCostData() {
      return readCosts();
    },

    saveOrUpdateCost(data) {
      const costs = readCosts();
      const id = data.id || String(Date.now());
      const row = [
        id,
        data.date,
        data.category,
        data.description || '',
        numberOrZero(data.amount),
        data.category === 'Benzin' ? (data.liters === '' ? '' : numberOrZero(data.liters)) : '',
        data.category === 'Benzin' ? (data.pricePerLiter === '' ? '' : numberOrZero(data.pricePerLiter)) : ''
      ];
      const index = costs.findIndex(cost => String(cost[0]) === String(id));
      if (index >= 0) {
        costs[index] = row;
        writeCosts(costs);
        return 'aktualisiert';
      }
      costs.push(row);
      writeCosts(costs);
      return 'gespeichert';
    },

    deleteCost(id) {
      writeCosts(readCosts().filter(cost => String(cost[0]) !== String(id)));
      return true;
    },

    getAvailableYears() {
      const years = new Set([String(new Date().getFullYear())]);
      readEntries().forEach(entry => years.add(String(entry[1] || '').slice(0, 4)));
      readCosts().forEach(cost => years.add(String(cost[1] || '').slice(0, 4)));
      return Array.from(years).filter(year => /^\d{4}$/.test(year)).sort((a, b) => Number(b) - Number(a));
    },

    setServerStartTime(time) {
      localStorage.setItem(ACTIVE_TRIP_KEY, time);
    },

    getServerStartTime() {
      return localStorage.getItem(ACTIVE_TRIP_KEY);
    },

    clearServerStartTime() {
      localStorage.removeItem(ACTIVE_TRIP_KEY);
    }
  };

  function createRunner(successHandler, failureHandler) {
    return new Proxy({}, {
      get(_, name) {
        if (name === 'withSuccessHandler') {
          return handler => createRunner(handler, failureHandler);
        }
        if (name === 'withFailureHandler') {
          return handler => createRunner(successHandler, handler);
        }
        return (...args) => {
          window.setTimeout(() => {
            try {
              const result = methods[name](...args);
              if (successHandler) successHandler(result);
            } catch (error) {
              if (failureHandler) failureHandler(error);
              else console.error(error);
            }
          }, 0);
        };
      }
    });
  }

  window.google = { script: { run: createRunner() } };

  document.addEventListener('DOMContentLoaded', () => {
    const banner = document.createElement('div');
    banner.className = 'alert alert-warning text-center small py-2 mb-3';
    banner.innerHTML = '<strong>Lokaler Testmodus:</strong> Daten liegen nur in diesem Browser und nicht im Google Sheet.';
    document.querySelector('.container').prepend(banner);
  });
})();
