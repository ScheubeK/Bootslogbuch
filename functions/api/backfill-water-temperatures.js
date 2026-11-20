const lake = 'lucernekreuztrichterandvitznauerbecken';
const model = 'simstrat';
const depthMetres = 1;
const targetYear = 2026;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function alplakesDate(value) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  const hour = String(value.getUTCHours()).padStart(2, '0');
  return `${year}${month}${day}${hour}00`;
}

function restUrl(base, table, query) {
  return `${base}/rest/v1/${table}?${new URLSearchParams(query)}`;
}

function closestTemperature(readings, at) {
  if (!readings.length) return null;
  const closest = readings.reduce((best, reading) => (
    Math.abs(new Date(reading.time) - at) < Math.abs(new Date(best.time) - at) ? reading : best
  ));
  return Math.round(closest.value * 10) / 10;
}

const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export async function onRequestPost({ request, env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return jsonResponse({ error: 'Supabase ist noch nicht konfiguriert.' }, 503);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return jsonResponse({ error: 'Anmeldung erforderlich.' }, 401);

  let body;
  try { body = await request.json(); } catch (_) { return jsonResponse({ error: 'Ungültige Anfrage.' }, 400); }
  const boatId = String(body.boatId || '');
  if (!/^[0-9a-f-]{36}$/i.test(boatId) || Number(body.year) !== targetYear) {
    return jsonResponse({ error: 'Diese Aktion ist nur für Ausflüge des Jahres 2026 verfügbar.' }, 400);
  }

  const authHeaders = { apikey: env.SUPABASE_ANON_KEY, Authorization: authorization };
  try {
    const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: authHeaders });
    const user = await userResponse.json();
    if (!userResponse.ok || !user?.id) return jsonResponse({ error: 'Anmeldung abgelaufen. Bitte melde dich erneut an.' }, 401);

    const membershipResponse = await fetch(restUrl(env.SUPABASE_URL, 'boat_memberships', {
      select: 'role', boat_id: `eq.${boatId}`, user_id: `eq.${user.id}`
    }), { headers: authHeaders });
    const memberships = await membershipResponse.json();
    if (!membershipResponse.ok || !memberships.length) return jsonResponse({ error: 'Du bist kein Mitglied dieses Boots.' }, 403);

    const tripsResponse = await fetch(restUrl(env.SUPABASE_URL, 'trips', {
      select: 'id,start_at', boat_id: `eq.${boatId}`,
      and: `(start_at.gte.${targetYear}-01-01T00:00:00.000Z,start_at.lt.${targetYear + 1}-01-01T00:00:00.000Z)`,
      water_temperature_c: 'is.null', order: 'start_at.asc'
    }), { headers: authHeaders });
    const trips = await tripsResponse.json();
    if (!tripsResponse.ok) throw new Error(trips.message || 'Ausflüge konnten nicht geladen werden.');
    if (!trips.length) return jsonResponse({ updated: 0, skipped: 0 });

    const tripsByMonth = new Map();
    trips.forEach(trip => {
      const month = new Date(trip.start_at).getUTCMonth();
      tripsByMonth.set(month, [...(tripsByMonth.get(month) || []), trip]);
    });

    const updates = [];
    let skipped = 0;
    for (const [month, monthTrips] of tripsByMonth) {
      const start = new Date(Date.UTC(targetYear, month, 1));
      const end = new Date(Date.UTC(targetYear, month + 1, 1));
      const sourceUrl = `https://alplakes-api.eawag.ch/simulations/1d/point/${model}/${lake}/${alplakesDate(start)}/${alplakesDate(end)}/${depthMetres}`;
      const sourceResponse = await fetch(sourceUrl, {
        headers: { 'User-Agent': 'Bootslogbuch/1.0 (+https://bootslogbuch.pages.dev/info.html)' }
      });
      if (!sourceResponse.ok) {
        skipped += monthTrips.length;
        await pause(750);
        continue;
      }
      const source = await sourceResponse.json();
      const readings = source.time?.map((time, index) => ({ time, value: Number(source.variables?.T?.data?.[index]) }))
        .filter(reading => Number.isFinite(reading.value)) || [];
      monthTrips.forEach(trip => {
        const temperature = closestTemperature(readings, new Date(trip.start_at));
        if (temperature === null) skipped += 1;
        else updates.push({ id: trip.id, temperature });
      });
      await pause(750);
    }

    let updated = 0;
    for (const update of updates) {
      const response = await fetch(restUrl(env.SUPABASE_URL, 'trips', {
        id: `eq.${update.id}`, boat_id: `eq.${boatId}`, water_temperature_c: 'is.null'
      }), {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ water_temperature_c: update.temperature })
      });
      if (response.ok) updated += 1;
      else skipped += 1;
    }

    return jsonResponse({ updated, skipped });
  } catch (_) {
    return jsonResponse({ error: 'Die Wassertemperaturen konnten nicht vollständig ergänzt werden. Bitte versuche es später erneut.' }, 503);
  }
}
