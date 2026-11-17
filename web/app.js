/* global bootstrap, supabase */
const state = {
  client: null,
  user: null,
  profile: null,
  boats: [],
  boat: null,
  role: null,
  trips: [],
  costs: [],
  activeTrip: null,
  finishingLiveTrip: false,
  selectedYear: String(new Date().getFullYear())
};

const categories = ['Benzin', 'Versicherungen', 'Steuern', 'Bootsplatz', 'Unterhalt'];
const money = new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' });
const number = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 });

const element = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[character]);
const formatCurrency = value => money.format(Number(value) || 0);
const numberOrZero = value => {
  const compact = String(value ?? '').replace(/[’'\s]/g, '');
  const normalized = compact.includes(',') ? compact.replace(/\./g, '').replace(',', '.') : compact;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};
const dateYear = value => String(value || '').slice(0, 4);

document.addEventListener('DOMContentLoaded', initialize);

async function initialize() {
  registerEvents();
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    const config = await response.json();
    if (!response.ok) throw new Error(config.error || 'Konfiguration konnte nicht geladen werden.');

    state.client = supabase.createClient(config.url, config.anonKey, {
      auth: { detectSessionInUrl: true, persistSession: true, flowType: 'pkce' }
    });
    state.client.auth.onAuthStateChange((_event, session) => window.setTimeout(() => handleSession(session), 0));
    const { data: { session }, error } = await state.client.auth.getSession();
    if (error) throw error;
    await handleSession(session);
  } catch (error) {
    showScreen('loginScreen');
    showNotice(error.message, 'danger');
  }
}

function registerEvents() {
  element('loginForm').addEventListener('submit', sendMagicLink);
  element('googleLoginButton').addEventListener('click', signInWithGoogle);
  element('createBoatForm').addEventListener('submit', createBoat);
  element('signOutButton').addEventListener('click', signOut);
  element('switchBoatButton').addEventListener('click', switchBoat);
  element('showTripForm').addEventListener('click', () => resetTripForm(true));
  element('cancelTripForm').addEventListener('click', () => resetTripForm(false));
  element('tripForm').addEventListener('submit', saveTrip);
  element('showCostForm').addEventListener('click', () => resetCostForm(true));
  element('cancelCostForm').addEventListener('click', () => resetCostForm(false));
  element('costForm').addEventListener('submit', saveCost);
  element('costCategory').addEventListener('change', updateFuelFields);
  element('liveTripSwitch').addEventListener('change', toggleLiveTrip);
  element('wineSwitch').addEventListener('change', event => setWineEnabled(event.target.checked));
  document.querySelectorAll('[data-wine]').forEach(button => button.addEventListener('click', () => setWine(Number(button.dataset.wine))));
  element('inviteForm').addEventListener('submit', createInvitation);
  element('exportCsvButton').addEventListener('click', exportCsv);
  ['dashboardYear', 'tripsYear', 'costsYear'].forEach(id => element(id).addEventListener('change', event => {
    state.selectedYear = event.target.value;
    syncYearSelectors();
    renderAll();
  }));
  document.querySelectorAll('#mainNav [data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
}

async function handleSession(session) {
  if (!session?.user) {
    state.user = null;
    showScreen('loginScreen');
    return;
  }
  state.user = session.user;
  await loadProfileAndBoats();
}

async function sendMagicLink(event) {
  event.preventDefault();
  if (!state.client) return;
  const button = event.currentTarget.querySelector('button');
  setBusy(button, true, 'Wird gesendet…');
  const email = element('loginEmail').value.trim().toLowerCase();
  // Eine Crew-Einladung enthält ?invite=<token>. Der Parameter muss nach dem
  // Magic-Link-Login noch vorhanden sein, damit sie automatisch angenommen wird.
  const redirectUrl = new URL(window.location.href);
  redirectUrl.hash = '';
  const { error } = await state.client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectUrl.toString() }
  });
  setBusy(button, false, 'Login-Link senden');
  if (error) return showNotice(error.message, 'danger');
  showNotice(`Login-Link wurde an ${email} gesendet.`, 'success');
}

async function signInWithGoogle(event) {
  if (!state.client) return;
  const button = event.currentTarget;
  setBusy(button, true, 'Google-Anmeldung wird geöffnet…');
  // Eine Crew-Einladung enthält ?invite=<token>. Dieser Parameter muss nach
  // dem OAuth-Login erhalten bleiben, damit die Einladung angenommen wird.
  const redirectUrl = new URL(window.location.href);
  redirectUrl.hash = '';
  const { error } = await state.client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUrl.toString() }
  });
  if (error) {
    setBusy(button, false, 'Mit Google anmelden');
    showNotice(error.message, 'danger');
  }
}

async function loadProfileAndBoats() {
  const [{ data: profile, error: profileError }, { data: memberships, error: membershipError }] = await Promise.all([
    state.client.from('profiles').select('id, email, display_name').eq('id', state.user.id).single(),
    state.client.from('boat_memberships').select('boat_id, role, boats(id, name)').eq('user_id', state.user.id)
  ]);
  if (profileError || membershipError) return showNotice((profileError || membershipError).message, 'danger');
  state.profile = profile;
  state.boats = (memberships || []).map(membership => ({
    id: membership.boat_id,
    role: membership.role,
    name: Array.isArray(membership.boats) ? membership.boats[0]?.name : membership.boats?.name
  })).filter(boat => boat.name);

  await acceptInvitationFromUrl();
  if (!state.boats.length) return showScreen('setupScreen');

  const storedBoatId = localStorage.getItem(`bootslogbuch.boat.${state.user.id}`);
  state.boat = state.boats.find(boat => boat.id === storedBoatId) || state.boats[0];
  state.role = state.boat.role;
  await loadBoatData();
  showScreen('appScreen');
}

async function acceptInvitationFromUrl() {
  const invitationToken = new URLSearchParams(window.location.search).get('invite');
  if (!invitationToken) return;
  const { error } = await state.client.rpc('accept_boat_invitation', { invitation_token: invitationToken });
  window.history.replaceState({}, '', window.location.pathname);
  if (error) {
    showNotice(error.message, 'danger');
    return;
  }
  showNotice('Crew-Einladung angenommen. Willkommen an Bord!');
  const { data: memberships } = await state.client.from('boat_memberships').select('boat_id, role, boats(id, name)').eq('user_id', state.user.id);
  state.boats = (memberships || []).map(membership => ({
    id: membership.boat_id,
    role: membership.role,
    name: Array.isArray(membership.boats) ? membership.boats[0]?.name : membership.boats?.name
  })).filter(boat => boat.name);
}

async function createBoat(event) {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  setBusy(button, true, 'Wird angelegt…');
  const { error } = await state.client.rpc('create_boat', { boat_name: element('boatName').value.trim() });
  setBusy(button, false, 'Boot anlegen');
  if (error) return showNotice(error.message, 'danger');
  element('boatName').value = '';
  await loadProfileAndBoats();
  showNotice('Boot angelegt. Du bist als Kapitän eingetragen.');
}

async function loadBoatData() {
  const [{ data: trips, error: tripsError }, { data: costs, error: costsError }, { data: activeTrip, error: activeTripError }] = await Promise.all([
    state.client.from('trips').select('*').eq('boat_id', state.boat.id).order('start_at', { ascending: false }),
    state.client.from('costs').select('*').eq('boat_id', state.boat.id).order('cost_date', { ascending: false }),
    state.client.from('active_trips').select('*').eq('boat_id', state.boat.id).maybeSingle()
  ]);
  if (tripsError || costsError) return showNotice((tripsError || costsError).message, 'danger');
  state.trips = trips || [];
  state.costs = costs || [];
  // Until migration 003 is installed, all existing functions remain usable.
  state.activeTrip = activeTripError ? null : activeTrip;
  populateYears();
  renderAll();
}

function populateYears() {
  const years = new Set([String(new Date().getFullYear())]);
  state.trips.forEach(trip => years.add(dateYear(trip.start_at)));
  state.costs.forEach(cost => years.add(dateYear(cost.cost_date)));
  const sorted = [...years].filter(year => /^\d{4}$/.test(year)).sort((a, b) => Number(b) - Number(a));
  if (!sorted.includes(state.selectedYear)) state.selectedYear = sorted[0];
  ['dashboardYear', 'tripsYear', 'costsYear'].forEach(id => {
    element(id).innerHTML = sorted.map(year => `<option value="${year}">${year}</option>`).join('');
  });
  syncYearSelectors();
}

function syncYearSelectors() {
  ['dashboardYear', 'tripsYear', 'costsYear'].forEach(id => { element(id).value = state.selectedYear; });
}

function renderAll() {
  element('boatTitle').textContent = `Bootslogbuch: ${state.boat.name}`;
  element('userLabel').textContent = state.profile.display_name || state.profile.email;
  element('currentRole').textContent = state.role === 'owner' ? 'Kapitän' : 'Crew';
  renderDashboard();
  renderTrips();
  renderCosts();
  renderLiveTrip();
  renderCrew();
}

function currentTrips() { return state.trips.filter(trip => dateYear(trip.start_at) === state.selectedYear); }
function currentCosts() { return state.costs.filter(cost => dateYear(cost.cost_date) === state.selectedYear); }

function renderDashboard() {
  const trips = currentTrips();
  const costs = currentCosts();
  const engineHours = trips.reduce((sum, trip) => sum + numberOrZero(trip.engine_end) - numberOrZero(trip.engine_start), 0);
  const seaTime = trips.reduce((sum, trip) => sum + Math.max(0, new Date(trip.end_at) - new Date(trip.start_at)), 0) / 3600000;
  const wine = trips.reduce((sum, trip) => sum + numberOrZero(trip.wine_bottles), 0);
  const totals = Object.fromEntries(categories.map(category => [category, 0]));
  costs.forEach(cost => { if (totals[cost.category] !== undefined) totals[cost.category] += numberOrZero(cost.amount_chf); });
  const totalCosts = Object.values(totals).reduce((sum, total) => sum + total, 0);
  element('metricTrips').textContent = trips.length;
  element('metricEngine').textContent = engineHours.toFixed(1).replace('.', ',');
  element('metricSeaTime').textContent = `${seaTime.toFixed(1).replace('.', ',')} h`;
  element('metricWine').textContent = `${wine} Fl.`;
  element('metricCost').textContent = formatCurrency(totalCosts);
  element('costBreakdown').innerHTML = categories.map(category => `<div class="col-6"><div class="small text-secondary">${category}</div><strong>${formatCurrency(totals[category])}</strong></div>`).join('');
  renderTrend();
}

function renderTrend() {
  const yearly = {};
  state.costs.forEach(cost => {
    const year = dateYear(cost.cost_date);
    yearly[year] = (yearly[year] || 0) + numberOrZero(cost.amount_chf);
  });
  const data = Object.entries(yearly).sort(([a], [b]) => Number(a) - Number(b)).map(([year, total]) => ({ year, total }));
  if (!data.length) {
    element('costTrend').innerHTML = '<div class="empty-state small">Noch keine Kosten für eine Jahresentwicklung vorhanden.</div>';
    return;
  }
  const maximum = Math.max(...data.map(item => item.total), 1);
  const magnitude = 10 ** Math.floor(Math.log10(maximum));
  const normalized = maximum / magnitude;
  const axisMaximum = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  const width = 350, left = 56, right = 14, top = 20, bottom = 44, height = 220;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const x = index => data.length === 1 ? left + plotWidth / 2 : left + (plotWidth / (data.length - 1)) * index;
  const y = total => top + plotHeight - total / axisMaximum * plotHeight;
  const ticks = Array.from({ length: 5 }, (_, index) => axisMaximum * index / 4);
  const points = data.map((item, index) => ({ ...item, x: x(index), y: y(item.total) }));
  element('costTrend').innerHTML = `<div class="trend-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Kostenentwicklung nach Jahr">
    <text class="trend-label" x="${left + plotWidth / 2}" y="${height - 5}" text-anchor="middle">Jahr</text>
    <text class="trend-label" x="12" y="${top + plotHeight / 2}" text-anchor="middle" transform="rotate(-90 12 ${top + plotHeight / 2})">Kosten (CHF)</text>
    ${ticks.map(tick => `<line class="trend-grid" x1="${left}" x2="${left + plotWidth}" y1="${y(tick)}" y2="${y(tick)}"></line><text class="trend-label" x="${left - 8}" y="${y(tick) + 3}" text-anchor="end">${number.format(tick)}</text>`).join('')}
    <line class="trend-axis" x1="${left}" x2="${left + plotWidth}" y1="${top + plotHeight}" y2="${top + plotHeight}"></line><line class="trend-axis" x1="${left}" x2="${left}" y1="${top}" y2="${top + plotHeight}"></line>
    ${points.map(point => `<text class="trend-year" x="${point.x}" y="${top + plotHeight + 19}" text-anchor="middle">${point.year}</text>`).join('')}
    <polyline class="trend-line" points="${points.map(point => `${point.x},${point.y}`).join(' ')}"></polyline>
    ${points.map(point => { const first = point.x < left + 35, last = point.x > left + plotWidth - 35; const labelX = first ? point.x + 7 : last ? point.x - 7 : point.x; const anchor = first ? 'start' : last ? 'end' : 'middle'; const labelY = point.y < top + 20 ? point.y + 16 : point.y - 8; return `<circle class="trend-point${point.year === state.selectedYear ? ' current' : ''}" cx="${point.x}" cy="${point.y}" r="${point.year === state.selectedYear ? 5.5 : 4}"><title>${point.year}: ${formatCurrency(point.total)}</title></circle><text class="trend-value" x="${labelX}" y="${labelY}" text-anchor="${anchor}">${number.format(point.total)}</text>`; }).join('')}
  </svg></div>`;
}

function renderTrips() {
  const trips = currentTrips();
  element('tripList').innerHTML = trips.length ? trips.map(trip => {
    const hours = numberOrZero(trip.engine_end) - numberOrZero(trip.engine_start);
    const date = new Date(trip.start_at).toLocaleDateString('de-CH');
    return `<article class="card entry-card"><div class="card-body py-3"><div class="d-flex justify-content-between gap-2"><div><strong>${date}</strong><div class="small text-secondary">${hours.toFixed(1).replace('.', ',')} Motorstunden${trip.wine_bottles ? ` · ${trip.wine_bottles} Fl. Wein` : ''}</div></div><div><button class="btn btn-link btn-sm p-0" onclick="editTrip('${trip.id}')" aria-label="Bearbeiten"><i class="bi bi-pencil-square"></i></button><button class="btn btn-link btn-sm p-0 ms-2 text-danger" onclick="deleteTrip('${trip.id}')" aria-label="Löschen"><i class="bi bi-trash"></i></button></div></div>${trip.weather ? `<div class="small text-secondary mt-2">${escapeHtml(trip.weather)}${trip.temperature_c !== null ? ` · ${trip.temperature_c}°C` : ''}</div>` : ''}${trip.remarks ? `<p class="small mb-0 mt-2">${escapeHtml(trip.remarks)}</p>` : ''}</div></article>`;
  }).join('') : '<div class="empty-state">Für dieses Jahr sind noch keine Ausflüge erfasst.</div>';
}

function localDateTime(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function renderLiveTrip() {
  const isActive = Boolean(state.activeTrip);
  element('liveTripCard').classList.toggle('is-active', isActive);
  element('liveTripSwitch').checked = isActive;
  element('liveTripStatus').textContent = isActive ? 'Ausflug läuft… ⛵' : 'Bereit zum Ablegen…';
  element('liveTripHint').textContent = isActive
    ? `Gestartet am ${new Date(state.activeTrip.started_at).toLocaleString('de-CH')}. Zum Beenden den Schalter ausschalten.`
    : 'Startzeit wird sicher gespeichert.';
}

async function toggleLiveTrip(event) {
  if (event.target.checked) {
    const startedAt = new Date().toISOString();
    const { data, error } = await state.client.from('active_trips')
      .insert({ boat_id: state.boat.id, started_by: state.user.id, started_at: startedAt })
      .select().single();
    if (error) {
      event.target.checked = false;
      if (error.code === '42P01') return showNotice('Live-Tracking ist noch nicht eingerichtet. Bitte zuerst Migration 003 ausführen.', 'danger');
      return showNotice(error.message, 'danger');
    }
    state.activeTrip = data;
    state.finishingLiveTrip = false;
    renderLiveTrip();
    showNotice('Ausflug gestartet. Die Startzeit bleibt auch nach Sleep oder Neustart erhalten.');
    return;
  }

  if (!state.activeTrip) return;
  state.finishingLiveTrip = true;
  resetTripForm(true);
  element('tripStart').value = localDateTime(state.activeTrip.started_at);
  element('tripEnd').value = localDateTime(new Date());
  element('liveTripStatus').textContent = 'Ausflug beenden und speichern…';
  element('liveTripHint').textContent = 'Bitte Motorstunden und weitere Angaben ergänzen, dann speichern.';
  element('liveTripSwitch').checked = false;
}

function setWineEnabled(enabled) {
  element('winePicker').classList.toggle('d-none', !enabled);
  if (enabled && !Number(element('tripWine').value)) setWine(1);
  if (!enabled) setWine(0);
}

function setWine(value) {
  const wine = Math.max(0, Math.min(6, Number(value) || 0));
  element('tripWine').value = wine;
  element('wineSwitch').checked = wine > 0;
  element('winePicker').classList.toggle('d-none', wine === 0);
  document.querySelectorAll('[data-wine]').forEach(button => button.classList.toggle('is-selected', Number(button.dataset.wine) <= wine));
  element('wineLabel').textContent = wine ? `${wine} ${wine === 1 ? 'Flasche' : 'Flaschen'}` : '';
}

function resetTripForm(show) {
  element('tripForm').classList.toggle('d-none', !show);
  if (!show) {
    element('tripForm').reset();
    element('tripId').value = '';
    state.finishingLiveTrip = false;
    setWine(0);
    renderLiveTrip();
    return;
  }
  element('tripForm').reset();
  element('tripId').value = '';
  const now = new Date();
  element('tripStart').value = localDateTime(now);
  element('tripEnd').value = localDateTime(new Date(now.getTime() + 2 * 60 * 60 * 1000));
  element('tripEngineStart').value = state.trips[0]?.engine_end ?? 0;
  element('tripEngineEnd').value = state.trips[0]?.engine_end ?? 0;
  setWine(0);
  element('tripForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveTrip(event) {
  event.preventDefault();
  const id = element('tripId').value;
  const values = {
    boat_id: state.boat.id, start_at: new Date(element('tripStart').value).toISOString(), end_at: new Date(element('tripEnd').value).toISOString(),
    engine_start: numberOrZero(element('tripEngineStart').value), engine_end: numberOrZero(element('tripEngineEnd').value),
    wine_bottles: Number(element('tripWine').value) || 0, remarks: element('tripRemarks').value.trim(), weather: element('tripWeather').value.trim() || null,
    temperature_c: element('tripTemperature').value === '' ? null : numberOrZero(element('tripTemperature').value), wind_kmh: element('tripWind').value === '' ? null : numberOrZero(element('tripWind').value)
  };
  if (!id) values.created_by = state.user.id;
  const request = id ? state.client.from('trips').update(values).eq('id', id) : state.client.from('trips').insert(values);
  const { error } = await request;
  if (error) return showNotice(error.message, 'danger');
  if (!id && state.finishingLiveTrip && state.activeTrip) {
    const { error: activeTripError } = await state.client.from('active_trips').delete().eq('boat_id', state.boat.id);
    if (activeTripError) return showNotice(`Ausflug gespeichert, Live-Status konnte aber nicht gelöscht werden: ${activeTripError.message}`, 'danger');
    state.activeTrip = null;
  }
  state.finishingLiveTrip = false;
  resetTripForm(false); await loadBoatData(); showNotice(id ? 'Ausflug aktualisiert.' : 'Ausflug gespeichert.');
}

window.editTrip = id => {
  const trip = state.trips.find(item => item.id === id); if (!trip) return;
  resetTripForm(true); element('tripId').value = trip.id;
  element('tripStart').value = localDateTime(trip.start_at); element('tripEnd').value = localDateTime(trip.end_at); element('tripEngineStart').value = trip.engine_start; element('tripEngineEnd').value = trip.engine_end; setWine(trip.wine_bottles); element('tripRemarks').value = trip.remarks || ''; element('tripWeather').value = trip.weather || ''; element('tripTemperature').value = trip.temperature_c ?? ''; element('tripWind').value = trip.wind_kmh ?? '';
};
window.deleteTrip = async id => { if (!confirm('Diesen Ausflug wirklich löschen?')) return; const { error } = await state.client.from('trips').delete().eq('id', id); if (error) return showNotice(error.message, 'danger'); await loadBoatData(); showNotice('Ausflug gelöscht.'); };

function renderCosts() {
  const costs = currentCosts();
  element('costList').innerHTML = costs.length ? costs.map(cost => `<article class="card entry-card"><div class="card-body py-3"><div class="d-flex justify-content-between gap-2"><div><strong>${escapeHtml(cost.category)}</strong><div class="small text-secondary">${new Date(`${cost.cost_date}T12:00`).toLocaleDateString('de-CH')}${cost.description ? ` · ${escapeHtml(cost.description)}` : ''}</div></div><div class="text-end"><div class="entry-value">${formatCurrency(cost.amount_chf)}</div><button class="btn btn-link btn-sm p-0" onclick="editCost('${cost.id}')" aria-label="Bearbeiten"><i class="bi bi-pencil-square"></i></button><button class="btn btn-link btn-sm p-0 ms-2 text-danger" onclick="deleteCost('${cost.id}')" aria-label="Löschen"><i class="bi bi-trash"></i></button></div></div></div></article>`).join('') : '<div class="empty-state">Für dieses Jahr sind noch keine Kosten erfasst.</div>';
}

function updateFuelFields() { document.querySelectorAll('.fuel-only').forEach(field => field.classList.toggle('d-none', element('costCategory').value !== 'Benzin')); }
function resetCostForm(show) { element('costForm').classList.toggle('d-none', !show); if (!show) { element('costForm').reset(); element('costId').value = ''; return; } element('costForm').reset(); element('costId').value = ''; element('costDate').value = new Date().toISOString().slice(0, 10); updateFuelFields(); element('costForm').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
async function saveCost(event) {
  event.preventDefault();
  const id = element('costId').value, isFuel = element('costCategory').value === 'Benzin';
  const values = { boat_id: state.boat.id, cost_date: element('costDate').value, category: element('costCategory').value, description: element('costDescription').value.trim(), amount_chf: numberOrZero(element('costAmount').value), litres: isFuel && element('costLitres').value !== '' ? numberOrZero(element('costLitres').value) : null, price_per_litre: isFuel && element('costPrice').value !== '' ? numberOrZero(element('costPrice').value) : null };
  if (!id) values.created_by = state.user.id;
  const { error } = await (id ? state.client.from('costs').update(values).eq('id', id) : state.client.from('costs').insert(values));
  if (error) return showNotice(error.message, 'danger');
  resetCostForm(false); await loadBoatData(); showNotice(id ? 'Kosten aktualisiert.' : 'Kosten gespeichert.');
}
window.editCost = id => { const cost = state.costs.find(item => item.id === id); if (!cost) return; resetCostForm(true); element('costId').value = cost.id; element('costDate').value = cost.cost_date; element('costCategory').value = cost.category; element('costDescription').value = cost.description || ''; element('costAmount').value = cost.amount_chf; element('costLitres').value = cost.litres ?? ''; element('costPrice').value = cost.price_per_litre ?? ''; updateFuelFields(); };
window.deleteCost = async id => { if (!confirm('Diesen Kostenposten wirklich löschen?')) return; const { error } = await state.client.from('costs').delete().eq('id', id); if (error) return showNotice(error.message, 'danger'); await loadBoatData(); showNotice('Kosten gelöscht.'); };

async function renderCrew() {
  const isOwner = state.role === 'owner';
  element('inviteForm').classList.toggle('d-none', !isOwner);
  const [{ data: members, error: membersError }, { data: invitations, error: invitationsError }] = await Promise.all([
    state.client.from('boat_memberships').select('user_id, role, profiles(email, display_name)').eq('boat_id', state.boat.id).order('created_at'),
    state.client.from('boat_invitations').select('id, email, token, expires_at').eq('boat_id', state.boat.id).is('accepted_at', null).order('created_at', { ascending: false })
  ]);
  if (membersError || invitationsError) return showNotice((membersError || invitationsError).message, 'danger');
  element('crewList').innerHTML = (members || []).map(member => {
    const canRemove = isOwner && member.role === 'crew';
    return `<article class="card entry-card"><div class="card-body py-3 d-flex justify-content-between gap-3"><div><strong>${escapeHtml(member.profiles?.display_name || member.profiles?.email || 'Crewmitglied')}</strong><div class="small text-secondary">${escapeHtml(member.profiles?.email || '')}</div></div><div class="d-flex flex-column align-items-end gap-2"><span class="badge ${member.role === 'owner' ? 'text-bg-primary' : 'text-bg-light'}">${member.role === 'owner' ? 'Kapitän' : 'Crew'}</span>${canRemove ? `<button class="btn btn-outline-danger btn-sm" onclick="removeCrewMember('${member.user_id}')"><i class="bi bi-person-dash me-1"></i>Entfernen</button>` : ''}</div></div></article>`;
  }).join('') || '<div class="empty-state">Noch keine Crewmitglieder.</div>';
  element('invitationList').innerHTML = isOwner && invitations?.length ? `<div class="small text-secondary mt-2">Offene Einladungen</div>${invitations.map(invitation => `<article class="card entry-card"><div class="card-body py-3"><strong>${escapeHtml(invitation.email)}</strong><div class="small text-secondary mt-1">Gültig bis ${new Date(invitation.expires_at).toLocaleDateString('de-CH')}</div><button class="btn btn-outline-primary btn-sm mt-2" onclick="copyInvitation('${invitation.token}')"><i class="bi bi-link-45deg me-1"></i>Einladungslink kopieren</button></div></article>`).join('')}` : '';
}

async function createInvitation(event) {
  event.preventDefault();
  const email = element('inviteEmail').value.trim().toLowerCase();
  const { error } = await state.client.from('boat_invitations').insert({ boat_id: state.boat.id, email, invited_by: state.user.id });
  if (error) return showNotice(error.message, 'danger');
  element('inviteEmail').value = ''; await renderCrew(); showNotice('Einladung erstellt. Kopiere nun den Einladungslink.');
}
window.copyInvitation = async token => { const link = `${window.location.origin}${window.location.pathname}?invite=${token}`; try { await navigator.clipboard.writeText(link); showNotice('Einladungslink kopiert.'); } catch (_) { window.prompt('Einladungslink kopieren:', link); } };
window.removeCrewMember = async userId => {
  if (state.role !== 'owner') return showNotice('Nur der Kapitän kann Crewmitglieder entfernen.', 'danger');
  const member = await state.client.from('boat_memberships').select('profiles(email, display_name)').eq('boat_id', state.boat.id).eq('user_id', userId).eq('role', 'crew').maybeSingle();
  if (member.error) return showNotice(member.error.message, 'danger');
  const name = member.data?.profiles?.display_name || member.data?.profiles?.email || 'dieses Crewmitglied';
  if (!confirm(`${name} wirklich vom Boot entfernen?`)) return;
  const { error } = await state.client.from('boat_memberships').delete().eq('boat_id', state.boat.id).eq('user_id', userId).eq('role', 'crew');
  if (error) return showNotice(error.message, 'danger');
  await renderCrew();
  showNotice('Crewmitglied entfernt.');
};

function csvCell(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
function downloadCsv(filename, headers, rows) {
  const content = `\uFEFF${[headers, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n')}`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
function exportCsv() {
  downloadCsv('Bootslogbuch_Ausfluege_alle_Jahre.csv', ['ID', 'Start', 'Ende', 'Motor Start', 'Motor Ende', 'Wein', 'Bemerkungen', 'Wetter', 'Temperatur', 'Wind'], state.trips.map(trip => [trip.id, trip.start_at, trip.end_at, trip.engine_start, trip.engine_end, trip.wine_bottles, trip.remarks, trip.weather, trip.temperature_c, trip.wind_kmh]));
  downloadCsv('Bootslogbuch_Kosten_alle_Jahre.csv', ['ID', 'Datum', 'Kategorie', 'Beschreibung', 'Betrag (CHF)', 'Liter', 'Preis/Liter'], state.costs.map(cost => [cost.id, cost.cost_date, cost.category, cost.description, cost.amount_chf, cost.litres, cost.price_per_litre]));
  showNotice('CSV-Export gestartet.');
}

function showView(view) { document.querySelectorAll('.app-view').forEach(section => section.classList.toggle('d-none', section.id !== `${view}View`)); document.querySelectorAll('#mainNav [data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view)); if (view === 'settings') renderCrew(); }
async function switchBoat() { if (state.boats.length < 2) return showNotice('Du bist aktuell nur Mitglied dieses Boots.'); const choices = state.boats.map((boat, index) => `${index + 1}: ${boat.name}`).join('\n'); const selected = Number(window.prompt(`Boot auswählen:\n${choices}`)); if (!selected || !state.boats[selected - 1]) return; state.boat = state.boats[selected - 1]; state.role = state.boat.role; localStorage.setItem(`bootslogbuch.boat.${state.user.id}`, state.boat.id); await loadBoatData(); showView('dashboard'); }
async function signOut() { await state.client.auth.signOut(); showNotice('Abgemeldet.'); }
function showScreen(id) { ['loadingScreen', 'loginScreen', 'setupScreen', 'appScreen'].forEach(screenId => element(screenId).classList.toggle('d-none', screenId !== id)); }
function showNotice(message, variant = 'success') { const notice = element('notice'); notice.className = `alert alert-${variant}`; notice.textContent = message; notice.classList.remove('d-none'); window.clearTimeout(showNotice.timeout); showNotice.timeout = window.setTimeout(() => notice.classList.add('d-none'), 5000); }
function setBusy(button, busy, label) { button.disabled = busy; button.textContent = label; }
