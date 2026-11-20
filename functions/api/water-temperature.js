const lake = 'lucernekreuztrichterandvitznauerbecken';
const model = 'simstrat';
const depthMetres = 1;
const cacheDurationMs = 3 * 60 * 60 * 1000;

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
  const now = new Date();
  const cacheSlot = Math.floor(now.getTime() / cacheDurationMs);
  const cacheKey = new Request(`${new URL(request.url).origin}/api/water-temperature?slot=${cacheSlot}`);
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
      lake: 'Kreuztrichter / Vitznauerbecken',
      depth_m: depthMetres,
      modelled: true
    }, 200, { 'Cache-Control': 'public, max-age=10800' });
    waitUntil(caches.default.put(cacheKey, result.clone()));
    return result;
  } catch (_) {
    return jsonResponse({ error: 'Wassertemperatur ist momentan nicht verfügbar.' }, 503, { 'Cache-Control': 'no-store' });
  }
}
