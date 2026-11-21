const model = 'simstrat';
const depthMetres = 1;
const cacheDurationMs = 3 * 60 * 60 * 1000;
const lakes = {
  lucernekreuztrichterandvitznauerbecken: 'Vierwaldstättersee – Kreuztrichter / Vitznauerbecken',
  zug: 'Zugersee',
  walensee: 'Walensee',
  upperzurich: 'Zürichsee – Obersee',
  lowerzurich: 'Zürichsee – Untersee',
  thun: 'Thunersee',
  brienz: 'Brienzersee',
  upperconstance: 'Bodensee – Obersee',
  lowerconstance: 'Bodensee – Untersee',
  geneva: 'Genfersee',
  maggiore: 'Lago Maggiore',
  upperlugano: 'Luganersee – Nordbecken',
  lowerlugano: 'Luganersee – Südbecken'
};
const defaultLake = 'lucernekreuztrichterandvitznauerbecken';

function alplakesDate(value) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  const hour = String(value.getUTCHours()).padStart(2, '0');
  return `${year}${month}${day}${hour}00`;
}

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

export async function onRequestGet({ request, waitUntil }) {
  const requestUrl = new URL(request.url);
  const lake = requestUrl.searchParams.get('lake') || defaultLake;
  if (!lakes[lake]) {
    return jsonResponse({ error: 'Unbekannter See.' }, 400, { 'Cache-Control': 'no-store' });
  }
  const now = new Date();
  const cacheSlot = Math.floor(now.getTime() / cacheDurationMs);
  const cacheKey = new Request(`${requestUrl.origin}/api/water-temperature?lake=${encodeURIComponent(lake)}&slot=${cacheSlot}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  const start = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const sourceUrl = `https://alplakes-api.eawag.ch/simulations/1d/point/${model}/${lake}/${alplakesDate(start)}/${alplakesDate(end)}/${depthMetres}`;

  try {
    const response = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'Bootslogbuch/1.0 (+https://bootslogbuch.pages.dev/info.html)' }
    });
    if (!response.ok) {
      return jsonResponse({ error: 'Wassertemperatur ist momentan nicht verfügbar.' }, 503, { 'Cache-Control': 'no-store' });
    }

    const data = await response.json();
    const readings = data.time?.map((time, index) => ({ time, value: Number(data.variables?.T?.data?.[index]) }))
      .filter(reading => Number.isFinite(reading.value)) || [];
    if (!readings.length) throw new Error('Keine Temperaturwerte verfügbar.');

    const closest = readings.reduce((best, reading) => (
      Math.abs(new Date(reading.time) - now) < Math.abs(new Date(best.time) - now) ? reading : best
    ));
    const result = jsonResponse({
      temperature_c: Math.round(closest.value * 10) / 10,
      measured_at: closest.time,
      source: 'Alplakes, Eawag',
      source_url: 'https://www.alplakes.eawag.ch/',
      lake: lakes[lake],
      depth_m: depthMetres,
      modelled: true
    }, 200, { 'Cache-Control': 'public, max-age=10800' });
    waitUntil(caches.default.put(cacheKey, result.clone()));
    return result;
  } catch (_) {
    return jsonResponse({ error: 'Wassertemperatur ist momentan nicht verfügbar.' }, 503, { 'Cache-Control': 'no-store' });
  }
}
