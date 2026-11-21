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
  boatMembers: [],
  costParticipants: [],
  costShares: [],
  costSettlements: [],
  costSharingAvailable: true,
  costsViewMode: 'entries',
  seasonReview: null,
  tripFilters: { open: false, query: '', from: '', to: '', weather: '' },
  activeTrip: null,
  finishingLiveTrip: false,
  weatherRequestId: 0,
  waterTemperatureRequestId: 0,
  dashboardMetricsAvailable: true,
  authMode: 'signin',
  passwordRecovery: false,
  selectedYear: String(new Date().getFullYear())
};

const categories = ['Treibstoff', 'Versicherungen', 'Steuern', 'Bootsplatz', 'Unterhalt'];
const money = new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' });
const number = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 });
const defaultWeatherLocation = 'Hergiswil NW, Schweiz';
const defaultWeatherCoordinates = { lat: 46.98515, lon: 8.30956 };
const defaultDashboardMetrics = ['trips', 'engine', 'seaTime', 'wine', 'costPerEngine', 'costPerTrip', 'costTotal'];
const dashboardMetricOptions = [
  { id: 'trips', label: 'Ausflüge', icon: 'bi-compass', theme: 'bg-trips' },
  { id: 'engine', label: 'Motorstunden', icon: 'bi-gear-wide-connected', theme: 'bg-engine' },
  { id: 'seaTime', label: 'Zeit auf See', icon: 'bi-clock-history', theme: 'bg-sea' },
  { id: 'wine', label: 'Weinkonsum', icon: 'bi-cup-straw', theme: 'bg-wine' },
  { id: 'costPerEngine', label: 'Kosten / Motorstunde', icon: 'bi-calculator', theme: 'bg-cost' },
  { id: 'costPerTrip', label: 'Kosten / Ausflug', icon: 'bi-receipt', theme: 'bg-sea' },
  { id: 'fuelLitres', label: 'Treibstoff verbraucht', icon: 'bi-fuel-pump', theme: 'bg-fuel' },
  { id: 'fuelPerEngine', label: 'Treibstoff / Motorstunde', icon: 'bi-speedometer', theme: 'bg-fuel' },
  { id: 'costPerSea', label: 'Kosten / Seestunde', icon: 'bi-water', theme: 'bg-cost' },
  { id: 'averageTripDuration', label: 'Ø Ausflugsdauer', icon: 'bi-hourglass-split', theme: 'bg-average' },
  { id: 'costTotal', label: 'Kosten Total', icon: 'bi-cash-stack', theme: 'bg-cost', wide: true }
];
const dashboardMetricIds = new Set(dashboardMetricOptions.map(metric => metric.id));
const weatherDescriptions = { 0: 'Klar', 1: 'Meist klar', 2: 'Teilweise bewölkt', 3: 'Bedeckt', 45: 'Neblig', 48: 'Reifnebel', 51: 'Leichter Nieselregen', 53: 'Nieselregen', 55: 'Starker Nieselregen', 56: 'Gefrierender Nieselregen', 57: 'Starker gefrierender Nieselregen', 61: 'Leichter Regen', 63: 'Regen', 65: 'Starker Regen', 66: 'Gefrierender Regen', 67: 'Starker gefrierender Regen', 71: 'Leichter Schneefall', 73: 'Schneefall', 75: 'Starker Schneefall', 77: 'Schneekörner', 80: 'Regenschauer', 81: 'Starke Regenschauer', 82: 'Heftige Regenschauer', 85: 'Schneeschauer', 86: 'Starke Schneeschauer', 95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'Starkes Gewitter mit Hagel' };

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
const boatFromMembership = membership => ({
  id: membership.boat_id,
  role: membership.role,
  name: Array.isArray(membership.boats) ? membership.boats[0]?.name : membership.boats?.name,
  weatherLocation: defaultWeatherLocation,
  weatherLat: defaultWeatherCoordinates.lat,
  weatherLon: defaultWeatherCoordinates.lon
});

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
    state.client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') state.passwordRecovery = true;
      window.setTimeout(() => handleSession(session), 0);
    });
    const { data: { session }, error } = await state.client.auth.getSession();
    if (error) throw error;
    await handleSession(session);
  } catch (error) {
    showScreen('loginScreen');
    showNotice(error.message, 'danger');
  }
}

function registerEvents() {
  element('emailAuthForm').addEventListener('submit', submitEmailAuth);
  element('googleLoginButton').addEventListener('click', signInWithGoogle);
  element('showRegistrationButton').addEventListener('click', () => setAuthMode('signup'));
  element('showPasswordResetButton').addEventListener('click', () => setAuthMode('reset'));
  element('backToLoginButton').addEventListener('click', () => setAuthMode('signin'));
  ['loginPassword', 'loginPasswordConfirm'].forEach(id => element(id).addEventListener('input', validatePasswordInputs));
  element('createBoatForm').addEventListener('submit', createBoat);
  element('createOwnBoatForm').addEventListener('submit', createBoat);
  element('createOwnBoatButton').addEventListener('click', showCreateOwnBoatDialog);
  element('dashboardMetricsForm').addEventListener('submit', saveDashboardMetrics);
  element('dashboardMetricsReset').addEventListener('click', restoreDashboardMetrics);
  element('seasonReviewButton').addEventListener('click', showSeasonReview);
  element('seasonReviewShareButton').addEventListener('click', shareSeasonReview);
  element('signOutButton').addEventListener('click', signOut);
  element('switchBoatButton').addEventListener('click', switchBoat);
  element('boatSwitchList').addEventListener('click', event => {
    const button = event.target.closest('[data-boat-id]');
    if (button) selectBoat(button.dataset.boatId);
  });
  element('showTripForm').addEventListener('click', () => resetTripForm(true));
  element('cancelTripForm').addEventListener('click', () => state.finishingLiveTrip ? cancelLiveTrip() : resetTripForm(false));
  element('tripForm').addEventListener('submit', saveTrip);
  element('toggleTripFilters').addEventListener('click', toggleTripFilters);
  element('tripFilterQuery').addEventListener('input', event => { state.tripFilters.query = event.target.value; renderTrips(); });
  element('tripFilterFrom').addEventListener('change', event => { state.tripFilters.from = event.target.value; renderTrips(); });
  element('tripFilterTo').addEventListener('change', event => { state.tripFilters.to = event.target.value; renderTrips(); });
  element('tripFilterWeather').addEventListener('change', event => { state.tripFilters.weather = event.target.value; renderTrips(); });
  element('resetTripFilters').addEventListener('click', resetTripFilters);
  element('showCostForm').addEventListener('click', () => { showCostsView('entries'); resetCostForm(true); });
  element('cancelCostForm').addEventListener('click', () => resetCostForm(false));
  element('costForm').addEventListener('submit', saveCost);
  element('costCategory').addEventListener('change', updateFuelFields);
  element('costShared').addEventListener('change', updateCostSharingFields);
  element('showCostEntries').addEventListener('click', () => showCostsView('entries'));
  element('showCostSharing').addEventListener('click', () => showCostsView('sharing'));
  element('costParticipantsForm').addEventListener('submit', saveCostParticipants);
  element('settlementForm').addEventListener('submit', saveSettlement);
  element('liveTripSwitch').addEventListener('change', toggleLiveTrip);
  element('wineSwitch').addEventListener('change', event => setWineEnabled(event.target.checked));
  document.querySelectorAll('[data-wine]').forEach(button => button.addEventListener('click', () => setWine(Number(button.dataset.wine))));
  ['tripStart', 'tripEngineStart', 'tripEngineEnd'].forEach(id => element(id).addEventListener('input', updateEngineHint));
  element('tripDetailEditButton').addEventListener('click', editTripFromDetail);
  element('inviteForm').addEventListener('submit', createInvitation);
  element('weatherSettingsForm').addEventListener('submit', saveWeatherLocation);
  element('exportExcelButton').addEventListener('click', exportExcel);
  element('importExcelInput').addEventListener('change', importExcel);
  element('resetDataButton').addEventListener('click', resetBoatData);
  setupSwipeToDelete(element('tripList'));
  setupSwipeToDelete(element('costList'));
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
    state.passwordRecovery = false;
    setAuthMode('signin');
    showScreen('loginScreen');
    return;
  }
  if (state.passwordRecovery || new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery') {
    state.passwordRecovery = true;
    setAuthMode('recovery');
    showScreen('loginScreen');
    return;
  }
  state.user = session.user;
  await loadProfileAndBoats();
}

function setAuthMode(mode) {
  state.authMode = mode;
  const isSignIn = mode === 'signin';
  const isSignUp = mode === 'signup';
  const isReset = mode === 'reset';
  const isRecovery = mode === 'recovery';
  const password = element('loginPassword');
  const confirmation = element('loginPasswordConfirm');
  const email = element('loginEmail');
  element('loginEmailGroup').classList.toggle('d-none', isRecovery);
  element('loginPasswordGroup').classList.toggle('d-none', isReset);
  element('loginPasswordConfirmGroup').classList.toggle('d-none', !(isSignUp || isRecovery));
  element('registrationCallout').classList.toggle('d-none', !isSignIn);
  element('showPasswordResetButton').classList.toggle('d-none', !isSignIn);
  element('backToLoginButton').classList.toggle('d-none', isSignIn || isRecovery);
  password.required = !isReset;
  confirmation.required = isSignUp || isRecovery;
  email.required = !isRecovery;
  password.autocomplete = isSignIn ? 'current-password' : 'new-password';
  element('emailAuthTitle').textContent = isSignUp ? 'Konto erstellen' : isReset ? 'Passwort einrichten' : isRecovery ? 'Neues Passwort setzen' : 'Mit E-Mail anmelden';
  element('emailAuthSubmit').textContent = isSignUp ? 'Konto erstellen' : isReset ? 'Link zum Passwort setzen senden' : isRecovery ? 'Neues Passwort speichern' : 'Anmelden';
  element('emailAuthHint').textContent = isSignUp
    ? 'Verwende dieselbe E-Mail-Adresse, an welche deine Crew-Einladung ging.'
    : isReset
      ? 'Auch bestehende Magic-Link-Nutzer können hier einmalig ein Passwort festlegen.'
      : isRecovery
        ? 'Wähle ein neues, sicheres Passwort für dein Konto.'
        : 'Melde dich mit deiner E-Mail-Adresse und deinem Passwort an.';
  if (isReset || isRecovery) {
    password.value = '';
    confirmation.value = '';
    password.setCustomValidity('');
    confirmation.setCustomValidity('');
  }
}

function passwordValidationMessage(password) {
  if (password.length < 12) return 'Das Passwort muss mindestens 12 Zeichen enthalten.';
  if (!/[a-z]/.test(password)) return 'Das Passwort muss einen Kleinbuchstaben enthalten.';
  if (!/[A-Z]/.test(password)) return 'Das Passwort muss einen Grossbuchstaben enthalten.';
  if (!/\d/.test(password)) return 'Das Passwort muss eine Zahl enthalten.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Das Passwort muss ein Sonderzeichen enthalten.';
  return '';
}

function validatePasswordInputs() {
  const password = element('loginPassword');
  const confirmation = element('loginPasswordConfirm');
  const needsStrongPassword = state.authMode === 'signup' || state.authMode === 'recovery';
  password.setCustomValidity(needsStrongPassword ? passwordValidationMessage(password.value) : '');
  confirmation.setCustomValidity(confirmation.value && confirmation.value !== password.value ? 'Die Passwörter stimmen nicht überein.' : '');
}

function authRedirectUrl() {
  const redirectUrl = new URL(window.location.href);
  redirectUrl.hash = '';
  return redirectUrl.toString();
}

async function submitEmailAuth(event) {
  event.preventDefault();
  if (!state.client) return;
  validatePasswordInputs();
  if (!event.currentTarget.reportValidity()) return;
  const button = element('emailAuthSubmit');
  const email = element('loginEmail').value.trim().toLowerCase();
  const password = element('loginPassword').value;
  const mode = state.authMode;
  setBusy(button, true, mode === 'signin' ? 'Anmeldung läuft…' : mode === 'signup' ? 'Konto wird erstellt…' : mode === 'recovery' ? 'Passwort wird gespeichert…' : 'Link wird gesendet…');
  let error;
  if (mode === 'signin') ({ error } = await state.client.auth.signInWithPassword({ email, password }));
  if (mode === 'signup') ({ error } = await state.client.auth.signUp({ email, password, options: { emailRedirectTo: authRedirectUrl() } }));
  if (mode === 'reset') ({ error } = await state.client.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() }));
  if (mode === 'recovery') ({ error } = await state.client.auth.updateUser({ password }));
  if (error) {
    setBusy(button, false, mode === 'signin' ? 'Anmelden' : mode === 'signup' ? 'Konto erstellen' : mode === 'recovery' ? 'Neues Passwort speichern' : 'Link zum Passwort setzen senden');
    return showNotice(error.message, 'danger');
  }
  if (mode === 'signup') {
    setAuthMode('signin');
    return showNotice(`Konto angelegt. Prüfe ${email}, um die E-Mail-Adresse zu bestätigen.`, 'success', { force: true });
  }
  if (mode === 'reset') return showNotice(`Ein Link zum Setzen deines Passworts wurde an ${email} gesendet.`, 'success', { force: true });
  if (mode === 'recovery') {
    state.passwordRecovery = false;
    window.history.replaceState({}, '', window.location.pathname + window.location.search);
    await handleSession((await state.client.auth.getSession()).data.session);
    return showNotice('Passwort gespeichert. Du bist jetzt angemeldet.');
  }
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
  const [{ data: selectedProfile, error: selectedProfileError }, { data: memberships, error: membershipError }] = await Promise.all([
    state.client.from('profiles').select('id, email, display_name, dashboard_metrics').eq('id', state.user.id).maybeSingle(),
    state.client.from('boat_memberships').select('boat_id, role, boats(id, name)').eq('user_id', state.user.id)
  ]);
  let profile = selectedProfile;
  let profileError = selectedProfileError;
  state.dashboardMetricsAvailable = true;
  // Die App bleibt auch während eines Deployments vor der zugehörigen Migration nutzbar.
  if (['42703', 'PGRST204'].includes(profileError?.code)) {
    const fallback = await state.client.from('profiles').select('id, email, display_name').eq('id', state.user.id).maybeSingle();
    profile = fallback.data;
    profileError = fallback.error;
    state.dashboardMetricsAvailable = false;
  }
  if (profileError || membershipError) return showNotice((profileError || membershipError).message, 'danger');
  if (!profile) {
    // Ein in Supabase gelöschtes Konto kann lokal noch eine alte Sitzung haben.
    // Diese entfernen wir, damit die Login-Seite statt eines Datenbankfehlers erscheint.
    await state.client.auth.signOut({ scope: 'local' });
    state.user = null;
    state.profile = null;
    state.boats = [];
    state.boat = null;
    setAuthMode('signin');
    showScreen('loginScreen');
    showNotice('Deine frühere Anmeldung ist nicht mehr gültig. Bitte melde dich erneut an.', 'warning');
    return;
  }
  state.profile = profile;
  state.boats = (memberships || []).map(boatFromMembership).filter(boat => boat.name);

  await acceptInvitationFromUrl();
  await loadWeatherSettings();
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
  state.boats = (memberships || []).map(boatFromMembership).filter(boat => boat.name);
}

async function loadWeatherSettings() {
  if (!state.boats.length) return;
  const { data, error } = await state.client.from('boats').select('id, weather_location, weather_lat, weather_lon').in('id', state.boats.map(boat => boat.id));
  // Migration 004 may not yet have been executed; the default remains usable.
  if (error) return;
  const settings = new Map((data || []).map(boat => [boat.id, boat]));
  state.boats.forEach(boat => {
    const value = settings.get(boat.id);
    if (!value) return;
    boat.weatherLocation = value.weather_location || defaultWeatherLocation;
    boat.weatherLat = Number(value.weather_lat) || defaultWeatherCoordinates.lat;
    boat.weatherLon = Number(value.weather_lon) || defaultWeatherCoordinates.lon;
  });
}

async function createBoat(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const isAdditionalBoat = form.id === 'createOwnBoatForm';
  const nameInput = element(isAdditionalBoat ? 'ownBoatName' : 'boatName');
  const button = form.querySelector('button[type="submit"]');
  setBusy(button, true, 'Wird angelegt…');
  const { data: boatId, error } = await state.client.rpc('create_boat', { boat_name: nameInput.value.trim() });
  setBusy(button, false, 'Boot anlegen');
  if (error) return showNotice(error.message, 'danger');
  nameInput.value = '';
  if (boatId) localStorage.setItem(`bootslogbuch.boat.${state.user.id}`, boatId);
  if (isAdditionalBoat) bootstrap.Modal.getOrCreateInstance(element('createOwnBoatModal')).hide();
  await loadProfileAndBoats();
  if (isAdditionalBoat) showView('dashboard');
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
  await loadCostSharing();
  // Until migration 003 is installed, all existing functions remain usable.
  state.activeTrip = activeTripError ? null : activeTrip;
  populateYears();
  renderAll();
}

function isMissingCostSharingError(error) {
  return ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error?.code);
}

async function loadCostSharing() {
  state.costSharingAvailable = true;
  const [{ data: members, error: membersError }, { data: participants, error: participantsError }, { data: settlements, error: settlementsError }] = await Promise.all([
    state.client.from('boat_memberships').select('user_id, role, profiles(email, display_name)').eq('boat_id', state.boat.id).order('created_at'),
    state.client.from('boat_cost_participants').select('user_id, profiles(email, display_name)').eq('boat_id', state.boat.id).order('created_at'),
    state.client.from('cost_settlements').select('*').eq('boat_id', state.boat.id).order('settlement_date', { ascending: false })
  ]);
  if (participantsError || settlementsError) {
    state.costSharingAvailable = false;
    state.boatMembers = members || [];
    state.costParticipants = [];
    state.costShares = [];
    state.costSettlements = [];
    if (!isMissingCostSharingError(participantsError || settlementsError)) showNotice((participantsError || settlementsError).message, 'danger');
    return;
  }
  const costIds = state.costs.map(cost => cost.id);
  let shares = [];
  if (costIds.length) {
    const { data, error } = await state.client.from('cost_shares').select('cost_id, user_id, share_amount, profiles(email, display_name)').in('cost_id', costIds);
    if (error) {
      state.costSharingAvailable = false;
      state.boatMembers = members || [];
      state.costParticipants = [];
      state.costShares = [];
      state.costSettlements = [];
      if (!isMissingCostSharingError(error)) showNotice(error.message, 'danger');
      return;
    }
    shares = data || [];
  }
  if (membersError) showNotice(membersError.message, 'danger');
  state.boatMembers = members || [];
  state.costParticipants = participants || [];
  state.costShares = shares;
  state.costSettlements = settlements || [];
}

function availableDataYears() {
  const years = new Set([String(new Date().getFullYear())]);
  state.trips.forEach(trip => years.add(dateYear(trip.start_at)));
  state.costs.forEach(cost => years.add(dateYear(cost.cost_date)));
  state.costSettlements.forEach(settlement => years.add(dateYear(settlement.settlement_date)));
  return [...years].filter(year => /^\d{4}$/.test(year)).sort((a, b) => Number(b) - Number(a));
}

function populateYears() {
  const sorted = availableDataYears();
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
  element('boatTitle').textContent = state.boat.name;
  element('userLabel').textContent = state.profile.display_name || state.profile.email;
  element('currentRole').textContent = state.role === 'owner' ? 'Kapitän' : 'Crew';
  renderDashboard();
  renderDashboardSettings();
  renderTrips();
  renderCosts();
  renderCostSharing();
  renderLiveTrip();
  renderWeatherSettings();
  renderCrew();
}

function currentTrips() { return state.trips.filter(trip => dateYear(trip.start_at) === state.selectedYear); }
function currentCosts() { return state.costs.filter(cost => dateYear(cost.cost_date) === state.selectedYear); }
function seaHours(trips) { return trips.reduce((sum, trip) => sum + Math.max(0, new Date(trip.end_at) - new Date(trip.start_at)), 0) / 3600000; }
function formatHours(value) { return `${value.toFixed(1).replace('.', ',')} h`; }
function selectedDashboardMetrics(value = state.profile?.dashboard_metrics) {
  if (!Array.isArray(value)) return [...defaultDashboardMetrics];
  const selected = [...new Set(value.filter(id => dashboardMetricIds.has(id)))];
  return selected.length ? dashboardMetricOptions.map(metric => metric.id).filter(id => selected.includes(id)) : [...defaultDashboardMetrics];
}
function dashboardComparison(current, previous, formatValue) {
  if (!previous) return 'Vorjahr: –';
  const difference = current - previous;
  const sign = difference > 0 ? '+' : difference < 0 ? '−' : '';
  const percentSign = difference >= 0 ? '+' : '−';
  return `Vorjahr: ${sign}${formatValue(Math.abs(difference))} (${percentSign}${Math.abs(difference / previous * 100).toFixed(0)} %)`;
}

function renderDashboard() {
  const trips = currentTrips();
  const costs = currentCosts();
  const engineHours = trips.reduce((sum, trip) => sum + numberOrZero(trip.engine_end) - numberOrZero(trip.engine_start), 0);
  const seaTime = seaHours(trips);
  const wine = trips.reduce((sum, trip) => sum + numberOrZero(trip.wine_bottles), 0);
  const totals = Object.fromEntries(categories.map(category => [category, 0]));
  costs.forEach(cost => { if (totals[cost.category] !== undefined) totals[cost.category] += numberOrZero(cost.amount_chf); });
  const totalCosts = Object.values(totals).reduce((sum, total) => sum + total, 0);
  const previousYear = String(Number(state.selectedYear) - 1);
  const previousCosts = state.costs.filter(cost => dateYear(cost.cost_date) === previousYear).reduce((sum, cost) => sum + numberOrZero(cost.amount_chf), 0);
  const previousTrips = state.trips.filter(trip => dateYear(trip.start_at) === previousYear);
  const previousSeaTime = seaHours(previousTrips);
  const fuelCosts = costs.filter(cost => cost.category === 'Treibstoff');
  const fuelEntries = fuelCosts.filter(cost => cost.litres !== null && cost.litres !== undefined && cost.litres !== '');
  const fuelLitres = fuelEntries.reduce((sum, cost) => sum + numberOrZero(cost.litres), 0);
  const metrics = {
    trips: { value: String(trips.length), comparison: dashboardComparison(trips.length, previousTrips.length, value => String(value)) },
    engine: { value: engineHours.toFixed(1).replace('.', ',') },
    seaTime: { value: formatHours(seaTime), comparison: dashboardComparison(seaTime, previousSeaTime, formatHours) },
    wine: { value: `${wine} Fl.` },
    costPerEngine: { value: engineHours > 0 ? `${formatCurrency(totalCosts / engineHours)}/h` : '–' },
    costPerTrip: { value: trips.length ? formatCurrency(totalCosts / trips.length) : '–' },
    costTotal: { value: formatCurrency(totalCosts), comparison: dashboardComparison(totalCosts, previousCosts, formatCurrency) },
    fuelLitres: { value: fuelEntries.length ? `${fuelLitres.toFixed(1).replace('.', ',')} l` : '–' },
    fuelPerEngine: { value: fuelEntries.length && engineHours > 0 ? `${(fuelLitres / engineHours).toFixed(1).replace('.', ',')} l/h` : '–' },
    costPerSea: { value: seaTime > 0 ? `${formatCurrency(totalCosts / seaTime)}/h` : '–' },
    averageTripDuration: { value: trips.length ? formatHours(seaTime / trips.length) : '–' }
  };
  const selected = selectedDashboardMetrics();
  const regularMetrics = selected.filter(id => !dashboardMetricOptions.find(metric => metric.id === id)?.wide);
  const lastRegularMetric = regularMetrics[regularMetrics.length - 1];
  element('dashboardMetrics').innerHTML = selected.map(id => {
    const definition = dashboardMetricOptions.find(metric => metric.id === id);
    const isWide = definition.wide || (id === lastRegularMetric && regularMetrics.length % 2 === 1);
    const metric = metrics[id];
    return `<div class="${isWide ? 'col-12' : 'col-6'}"><div class="metric-card ${definition.theme}"><i class="bi ${definition.icon}"></i><span>${definition.label}</span><strong>${metric.value}</strong>${metric.comparison ? `<span>${metric.comparison}</span>` : ''}</div></div>`;
  }).join('');
  element('costBreakdown').innerHTML = categories.map(category => `<div class="col-6"><div class="small text-secondary">${category}</div><strong>${formatCurrency(totals[category])}</strong></div>`).join('');
  renderSeasonReview({ trips, costs, totals, totalCosts, engineHours, seaTime, wine });
  renderTrend();
}

function seasonDate(value) {
  return new Date(value).toLocaleDateString('de-CH', { day: '2-digit', month: 'long', year: 'numeric' });
}

function renderSeasonReview({ trips, costs, totals, totalCosts, engineHours, seaTime, wine }) {
  const hasData = trips.length > 0 || costs.length > 0;
  element('seasonReviewCard').classList.toggle('d-none', !hasData);
  if (!hasData) {
    state.seasonReview = null;
    return;
  }
  const orderedTrips = [...trips].sort((left, right) => new Date(left.start_at) - new Date(right.start_at));
  const firstTrip = orderedTrips[0];
  const lastTrip = orderedTrips[orderedTrips.length - 1];
  const longestTrip = orderedTrips.reduce((longest, trip) => {
    const duration = Math.max(0, new Date(trip.end_at) - new Date(trip.start_at));
    return !longest || duration > longest.duration ? { trip, duration } : longest;
  }, null);
  const waterTrips = orderedTrips.filter(trip => trip.water_temperature_c !== null && trip.water_temperature_c !== undefined && trip.water_temperature_c !== '' && Number.isFinite(Number(trip.water_temperature_c)));
  const warmestWater = waterTrips.reduce((warmest, trip) => !warmest || Number(trip.water_temperature_c) > Number(warmest.water_temperature_c) ? trip : warmest, null);
  const costsByCategory = categories.filter(category => totals[category] > 0).map(category => `<div class="season-cost-row"><span>${escapeHtml(category)}</span><strong>${formatCurrency(totals[category])}</strong></div>`).join('') || '<div class="text-secondary small">Keine Kosten erfasst.</div>';
  const highlights = [
    firstTrip ? { icon: 'bi-sunrise', label: 'Erste Fahrt', value: seasonDate(firstTrip.start_at) } : null,
    lastTrip ? { icon: 'bi-sunset', label: 'Letzte Fahrt', value: seasonDate(lastTrip.start_at) } : null,
    longestTrip ? { icon: 'bi-clock-history', label: 'Längster Ausflug', value: `${formatHours(longestTrip.duration / 3600000)} · ${seasonDate(longestTrip.trip.start_at)}` } : null,
    warmestWater ? { icon: 'bi-droplet-fill', label: 'Wärmstes Wasser', value: `${Number(warmestWater.water_temperature_c).toLocaleString('de-CH', { maximumFractionDigits: 1 })} °C · ${seasonDate(warmestWater.start_at)}` } : null
  ].filter(Boolean);
  state.seasonReview = { year: state.selectedYear, boatName: state.boat.name, trips: trips.length, seaTime, engineHours, wine, totalCosts, highlights };
  element('seasonReviewTitle').textContent = `Saison ${state.selectedYear} · ${state.boat.name}`;
  element('seasonReviewHint').textContent = `Die Highlights aus ${state.selectedYear} ansehen.`;
  element('seasonReviewBody').innerHTML = `
    <p class="text-secondary mb-4">Dein Rückblick auf die Saison ${state.selectedYear}.</p>
    <div class="season-summary-grid mb-4">
      <div><i class="bi bi-compass"></i><span>Ausflüge</span><strong>${trips.length}</strong></div>
      <div><i class="bi bi-clock-history"></i><span>Zeit auf See</span><strong>${formatHours(seaTime)}</strong></div>
      <div><i class="bi bi-gear-wide-connected"></i><span>Motorstunden</span><strong>${engineHours.toFixed(1).replace('.', ',')} h</strong></div>
      <div><i class="bi bi-cup-straw"></i><span>Wein</span><strong>${wine} Fl.</strong></div>
      <div class="season-summary-wide"><i class="bi bi-cash-stack"></i><span>Kosten Total</span><strong>${formatCurrency(totalCosts)}</strong></div>
    </div>
    <h3 class="h6 mb-3">Highlights</h3>
    <div class="vstack gap-2 mb-4">${highlights.length ? highlights.map(highlight => `<div class="season-highlight"><i class="bi ${highlight.icon}"></i><div><span>${highlight.label}</span><strong>${highlight.value}</strong></div></div>`).join('') : '<div class="text-secondary small">Für dieses Jahr sind noch keine Ausflüge erfasst.</div>'}</div>
    <h3 class="h6 mb-3">Kosten nach Kategorie</h3>
    <div class="season-cost-list">${costsByCategory}</div>`;
}

function showSeasonReview() {
  bootstrap.Modal.getOrCreateInstance(element('seasonReviewModal')).show();
}

async function shareSeasonReview() {
  const review = state.seasonReview;
  if (!review) return showNotice('Für diesen Saisonrückblick sind keine Daten vorhanden.', 'warning');
  const text = [
    `Saisonrückblick ${review.year} · ${review.boatName}`,
    '',
    `${review.trips} Ausflüge`,
    `${formatHours(review.seaTime)} auf See`,
    `${review.engineHours.toFixed(1).replace('.', ',')} Motorstunden`,
    `${review.wine} Flaschen Wein`,
    `${formatCurrency(review.totalCosts)} Kosten`,
    ...review.highlights.map(highlight => `${highlight.label}: ${highlight.value}`)
  ].join('\n');
  try {
    if (navigator.share) {
      await navigator.share({ title: `Saisonrückblick ${review.year} · ${review.boatName}`, text, url: window.location.origin });
      return;
    }
    await navigator.clipboard.writeText(text);
    showNotice('Saisonrückblick in die Zwischenablage kopiert.', 'success', { force: true });
  } catch (error) {
    if (error?.name === 'AbortError') return;
    try {
      await navigator.clipboard.writeText(text);
      showNotice('Saisonrückblick in die Zwischenablage kopiert.', 'success', { force: true });
    } catch (_) {
      window.prompt('Saisonrückblick kopieren:', text);
    }
  }
}

function renderDashboardSettings() {
  const selected = selectedDashboardMetrics();
  const disabled = state.dashboardMetricsAvailable ? '' : ' disabled';
  element('dashboardMetricOptions').innerHTML = dashboardMetricOptions.map(metric => `<label class="form-check form-switch dashboard-option"><input class="form-check-input" type="checkbox" name="dashboardMetric" value="${metric.id}"${selected.includes(metric.id) ? ' checked' : ''}${disabled}><span class="form-check-label">${metric.label}</span></label>`).join('');
  element('dashboardMetricsSave').disabled = !state.dashboardMetricsAvailable;
  element('dashboardMetricsReset').disabled = !state.dashboardMetricsAvailable;
  element('dashboardMetricsHint').textContent = state.dashboardMetricsAvailable
    ? 'Wähle die Kennzahlen, die du auf deinem Dashboard sehen möchtest. Die Auswahl gilt nur für dich – unabhängig vom verwendeten Gerät.'
    : 'Dashboard-Auswahl wird nach der Supabase-Migration verfügbar.';
}

async function persistDashboardMetrics(metricIds, button, successMessage) {
  if (!state.dashboardMetricsAvailable) return showNotice('Bitte zuerst die Dashboard-Migration in Supabase ausführen.', 'warning');
  if (!metricIds.length) return showNotice('Wähle mindestens eine Dashboard-Kachel aus.', 'warning');
  const originalLabel = button.textContent;
  setBusy(button, true, 'Wird gespeichert…');
  try {
    const { data, error } = await state.client.from('profiles').update({ dashboard_metrics: metricIds }).eq('id', state.user.id).select('dashboard_metrics').single();
    if (error) {
      if (['42703', 'PGRST204'].includes(error.code)) {
        state.dashboardMetricsAvailable = false;
        renderDashboardSettings();
        throw new Error('Bitte zuerst die Dashboard-Migration in Supabase ausführen.');
      }
      throw error;
    }
    state.profile.dashboard_metrics = data?.dashboard_metrics || metricIds;
    renderDashboard();
    renderDashboardSettings();
    showNotice(successMessage);
  } catch (error) {
    showNotice(error.message || 'Dashboard-Auswahl konnte nicht gespeichert werden.', 'danger');
  } finally {
    setBusy(button, false, originalLabel);
  }
}

function saveDashboardMetrics(event) {
  event.preventDefault();
  const selected = [...document.querySelectorAll('input[name="dashboardMetric"]:checked')].map(input => input.value);
  return persistDashboardMetrics(selected, event.currentTarget.querySelector('button[type="submit"]'), 'Dashboard-Auswahl gespeichert.');
}

function restoreDashboardMetrics(event) {
  return persistDashboardMetrics([...defaultDashboardMetrics], event.currentTarget, 'Standardauswahl wiederhergestellt.');
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
  // Auf kleinen Bildschirmen würden bei einer langen Historie alle Jahreszahlen
  // ineinanderlaufen. Alle Werte bleiben als Punkte sichtbar, die X-Achse zeigt
  // aber höchstens sieben gut lesbare Orientierungspunkte (plus das gewählte Jahr).
  const labelInterval = Math.max(1, Math.ceil(data.length / 7));
  const yearLabelIndexes = new Set([0, data.length - 1]);
  points.forEach((point, index) => {
    if (index % labelInterval === 0 || point.year === state.selectedYear) yearLabelIndexes.add(index);
  });
  element('costTrend').innerHTML = `<div class="trend-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Kostenentwicklung nach Jahr">
    <text class="trend-label" x="${left + plotWidth / 2}" y="${height - 5}" text-anchor="middle">Jahr</text>
    <text class="trend-label" x="12" y="${top + plotHeight / 2}" text-anchor="middle" transform="rotate(-90 12 ${top + plotHeight / 2})">Kosten (CHF)</text>
    ${ticks.map(tick => `<line class="trend-grid" x1="${left}" x2="${left + plotWidth}" y1="${y(tick)}" y2="${y(tick)}"></line><text class="trend-label" x="${left - 8}" y="${y(tick) + 3}" text-anchor="end">${number.format(tick)}</text>`).join('')}
    <line class="trend-axis" x1="${left}" x2="${left + plotWidth}" y1="${top + plotHeight}" y2="${top + plotHeight}"></line><line class="trend-axis" x1="${left}" x2="${left}" y1="${top}" y2="${top + plotHeight}"></line>
    ${points.filter((_, index) => yearLabelIndexes.has(index)).map(point => `<text class="trend-year" x="${point.x}" y="${top + plotHeight + 19}" text-anchor="middle">${point.year}</text>`).join('')}
    <polyline class="trend-line" points="${points.map(point => `${point.x},${point.y}`).join(' ')}"></polyline>
    ${points.map(point => { const first = point.x < left + 35, last = point.x > left + plotWidth - 35; const labelX = first ? point.x + 7 : last ? point.x - 7 : point.x; const anchor = first ? 'start' : last ? 'end' : 'middle'; const labelY = point.y < top + 20 ? point.y + 16 : point.y - 8; return `<circle class="trend-point${point.year === state.selectedYear ? ' current' : ''}" cx="${point.x}" cy="${point.y}" r="${point.year === state.selectedYear ? 5.5 : 4}"><title>${point.year}: ${formatCurrency(point.total)}</title></circle><text class="trend-value" x="${labelX}" y="${labelY}" text-anchor="${anchor}">${number.format(point.total)}</text>`; }).join('')}
  </svg></div>`;
}

function renderTrips() {
  const allTrips = currentTrips();
  const trips = filteredTrips(allTrips);
  renderTripFilters(allTrips, trips);
  element('tripList').innerHTML = trips.length ? trips.map(trip => {
    const hours = numberOrZero(trip.engine_end) - numberOrZero(trip.engine_start);
    const date = new Date(trip.start_at).toLocaleDateString('de-CH');
    const conditions = [
      trip.temperature_c !== null && trip.temperature_c !== undefined ? `<span><i class="bi bi-thermometer-half text-danger me-1"></i>${trip.temperature_c}°C</span>` : '',
      trip.weather ? `<span><i class="bi bi-cloud-sun me-1"></i>${escapeHtml(trip.weather)}</span>` : '',
      trip.wind_kmh !== null && trip.wind_kmh !== undefined ? `<span><i class="bi bi-wind me-1"></i>${trip.wind_kmh} km/h</span>` : '',
      trip.water_temperature_c !== null && trip.water_temperature_c !== undefined ? `<span><i class="bi bi-droplet-fill text-primary me-1"></i>${trip.water_temperature_c}°C</span>` : ''
    ].filter(Boolean).join('');
    return `<div class="swipe-entry" data-delete-kind="trip" data-delete-id="${trip.id}"><button class="swipe-delete-action" type="button" data-swipe-delete aria-label="Ausflug löschen"><i class="bi bi-trash3"></i><span>Löschen</span></button><article class="card entry-card"><div class="card-body py-3"><div class="d-flex justify-content-between gap-2"><div><strong>${date}</strong><div class="small text-secondary">${hours.toFixed(1).replace('.', ',')} Motorstunden${trip.wine_bottles ? ` · ${trip.wine_bottles} Fl. Wein` : ''}</div></div><div><button class="btn btn-link btn-sm p-0" onclick="showTripDetails('${trip.id}')" aria-label="Details"><i class="bi bi-chevron-right"></i></button><button class="btn btn-link btn-sm p-0 ms-2" onclick="editTrip('${trip.id}')" aria-label="Bearbeiten"><i class="bi bi-pencil-square"></i></button><button class="btn btn-link btn-sm p-0 ms-2 text-danger" onclick="deleteTrip('${trip.id}')" aria-label="Löschen"><i class="bi bi-trash"></i></button></div></div>${conditions ? `<div class="trip-conditions small text-secondary mt-2">${conditions}</div>` : ''}${trip.remarks ? `<p class="small mb-0 mt-2">${escapeHtml(trip.remarks)}</p>` : ''}</div></article></div>`;
  }).join('') : `<div class="empty-state">${allTrips.length && hasTripFilters() ? 'Keine Ausflüge entsprechen den gewählten Filtern.' : 'Für dieses Jahr sind noch keine Ausflüge erfasst.'}</div>`;
}

function normalizedTripSearch(value) {
  return String(value || '').trim().toLocaleLowerCase('de-CH');
}

function tripFilterDate(trip) {
  return localDateTime(trip.start_at).slice(0, 10);
}

function filteredTrips(trips) {
  const { query, from, to, weather } = state.tripFilters;
  const search = normalizedTripSearch(query);
  return trips.filter(trip => {
    const date = tripFilterDate(trip);
    const searchable = normalizedTripSearch(`${trip.remarks || ''} ${trip.weather || ''}`);
    return (!search || searchable.includes(search))
      && (!from || date >= from)
      && (!to || date <= to)
      && (!weather || trip.weather === weather);
  });
}

function hasTripFilters() {
  const { query, from, to, weather } = state.tripFilters;
  return Boolean(query || from || to || weather);
}

function renderTripFilters(allTrips, trips) {
  const { open, query, from, to, weather } = state.tripFilters;
  const weatherValues = [...new Set(allTrips.map(trip => String(trip.weather || '').trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'de-CH'));
  element('tripFilterPanel').classList.toggle('d-none', !open);
  element('toggleTripFilters').classList.toggle('btn-primary', hasTripFilters());
  element('toggleTripFilters').classList.toggle('btn-outline-secondary', !hasTripFilters());
  element('toggleTripFilters').setAttribute('aria-expanded', String(open));
  element('tripFilterQuery').value = query;
  element('tripFilterFrom').value = from;
  element('tripFilterTo').value = to;
  element('tripFilterWeather').innerHTML = `<option value="">Alle Wetter</option>${weatherValues.map(value => `<option value="${escapeHtml(value)}"${value === weather ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('')}`;
  element('tripFilterResult').textContent = hasTripFilters() ? `${trips.length} von ${allTrips.length} Ausflügen werden angezeigt.` : `${allTrips.length} Ausflüge im Jahr ${state.selectedYear}.`;
}

function toggleTripFilters() {
  state.tripFilters.open = !state.tripFilters.open;
  renderTrips();
}

function resetTripFilters() {
  state.tripFilters = { ...state.tripFilters, query: '', from: '', to: '', weather: '' };
  renderTrips();
}

function setupSwipeToDelete(container) {
  let gesture = null;
  const closeOpenEntries = except => container.querySelectorAll('.swipe-entry.is-delete-revealed').forEach(entry => { if (entry !== except) entry.classList.remove('is-delete-revealed'); });
  container.addEventListener('pointerdown', event => {
    const entry = event.target.closest('.swipe-entry');
    if (!entry || event.pointerType === 'mouse' || event.target.closest('button, a, input, select, textarea, label')) return;
    gesture = { entry, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, horizontal: false };
    container.setPointerCapture?.(event.pointerId);
  });
  container.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    if (!gesture.horizontal && Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY)) gesture.horizontal = true;
    if (!gesture.horizontal) return;
    event.preventDefault();
    if (deltaX < -22) {
      closeOpenEntries(gesture.entry);
      gesture.entry.classList.add('is-delete-revealed');
    } else if (deltaX > 22) gesture.entry.classList.remove('is-delete-revealed');
  });
  container.addEventListener('pointerup', event => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const deltaX = event.clientX - gesture.startX;
    if (gesture.horizontal && deltaX > -60) gesture.entry.classList.remove('is-delete-revealed');
    gesture = null;
  });
  container.addEventListener('pointercancel', () => { if (gesture) gesture.entry.classList.remove('is-delete-revealed'); gesture = null; });
  container.addEventListener('click', event => {
    const button = event.target.closest('[data-swipe-delete]');
    if (!button) return;
    const entry = button.closest('.swipe-entry');
    if (entry?.dataset.deleteKind === 'trip') window.deleteTrip(entry.dataset.deleteId);
    if (entry?.dataset.deleteKind === 'cost') window.deleteCost(entry.dataset.deleteId);
  });
}

function localDateTime(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function previousTripForEngineReading(startValue, excludedId = '') {
  const startAt = new Date(startValue).getTime();
  if (!Number.isFinite(startAt)) return null;
  return state.trips
    .filter(trip => trip.id !== excludedId && new Date(trip.start_at).getTime() < startAt)
    .sort((a, b) => new Date(b.start_at) - new Date(a.start_at))[0] || null;
}

function updateEngineHint() {
  const hint = element('tripEngineHint');
  const engineStartInput = element('tripEngineStart');
  const engineEndInput = element('tripEngineEnd');
  const engineStart = numberOrZero(engineStartInput.value);
  const engineEnd = numberOrZero(engineEndInput.value);
  const previousTrip = previousTripForEngineReading(element('tripStart').value, element('tripId').value);
  const previousEnd = previousTrip ? numberOrZero(previousTrip.engine_end) : null;
  const messages = [];

  engineEndInput.setCustomValidity('');
  hint.className = 'small text-secondary';
  if (previousEnd !== null) messages.push(`Letzter Endstand: ${previousEnd.toFixed(1).replace('.', ',')} h.`);
  if (engineEndInput.value !== '' && engineEnd < engineStart) {
    engineEndInput.setCustomValidity('Der Motor-Endstand darf nicht kleiner als der Startstand sein.');
    hint.className = 'small text-danger';
    messages.push('Der Endstand liegt unter dem Startstand.');
  } else if (previousEnd !== null && engineStartInput.value !== '' && engineStart < previousEnd) {
    hint.className = 'small text-warning';
    messages.push('Prüfen: Der Startstand liegt unter dem letzten Endstand.');
  } else if (previousEnd !== null && engineStartInput.value !== '' && engineStart === previousEnd) {
    messages.push('Motorstunden automatisch vom letzten Ausflug übernommen.');
  }
  hint.textContent = messages.join(' ');
}

function renderLiveTrip() {
  const isRunning = Boolean(state.activeTrip) && !state.finishingLiveTrip;
  element('liveTripCard').classList.toggle('is-active', isRunning);
  element('livePropeller').classList.toggle('d-none', !isRunning);
  element('liveTripSwitch').checked = isRunning;
  element('liveTripSwitch').disabled = state.finishingLiveTrip;
  element('liveTripStatus').textContent = isRunning ? 'Ausflug läuft…' : state.activeTrip ? 'Ausflug beenden und speichern…' : 'Bereit zum Ablegen…';
  element('liveTripHint').textContent = isRunning
    ? `Gestartet am ${new Date(state.activeTrip.started_at).toLocaleString('de-CH')}. Zum Beenden den Schalter ausschalten.`
    : state.activeTrip ? 'Bitte Motorstunden und weitere Angaben ergänzen, dann speichern.' : 'Startzeit wird sicher gespeichert.';
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
  renderLiveTrip();
}

async function cancelLiveTrip() {
  if (!state.activeTrip || !state.finishingLiveTrip) return;
  if (!confirm('Diesen gestarteten Ausflug wirklich abbrechen? Es wird kein Logbucheintrag gespeichert.')) return;
  const { error } = await state.client.from('active_trips').delete().eq('boat_id', state.boat.id);
  if (error) return showNotice(`Ausflug konnte nicht abgebrochen werden: ${error.message}`, 'danger');
  state.activeTrip = null;
  state.finishingLiveTrip = false;
  resetTripForm(false);
  renderLiveTrip();
  showNotice('Ausflug abgebrochen. Es wurde kein Eintrag gespeichert.');
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

function renderWeatherSettings() {
  if (!state.boat) return;
  const isOwner = state.role === 'owner';
  element('weatherSettingsForm').classList.toggle('d-none', !isOwner);
  element('backupDataCard').classList.toggle('d-none', !isOwner);
  element('resetDataCard').classList.toggle('d-none', !isOwner);
  const resetYears = availableDataYears();
  const defaultResetYear = resetYears[resetYears.length - 1];
  element('resetDataYear').innerHTML = [...resetYears.map(year => `<option value="${year}"${year === defaultResetYear ? ' selected' : ''}>Nur Jahr ${year}</option>`), '<option value="all">Alle Jahre</option>'].join('');
  element('weatherLocation').value = state.boat.weatherLocation || defaultWeatherLocation;
  element('weatherSettingsHint').textContent = isOwner
    ? 'Für neue Ausflüge werden Wetter, Temperatur und Wind automatisch übernommen.'
    : 'Der Wetterort wird vom Kapitän verwaltet.';
}

async function resetBoatData(event) {
  if (state.role !== 'owner') return showNotice('Nur der Kapitän kann das Logbuch löschen.', 'danger');
  const scope = element('resetDataYear').value;
  const allYears = scope === 'all';
  const description = allYears ? 'alle Ausflüge, Kosten und Ausgleichszahlungen' : `alle Ausflüge, Kosten und Ausgleichszahlungen aus dem Jahr ${scope}`;
  if (!confirm(`Wirklich ${description} von „${state.boat.name}“ löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.`)) return;
  const button = event.currentTarget;
  setBusy(button, true, 'Wird gelöscht…');
  const { error } = allYears
    ? await state.client.rpc('reset_boat_data', { target_boat_id: state.boat.id })
    : await state.client.rpc('delete_boat_year_data', { target_boat_id: state.boat.id, target_year: Number(scope) });
  setBusy(button, false, 'Löschen');
  if (error) return showNotice(error.message, 'danger');
  state.activeTrip = null;
  state.finishingLiveTrip = false;
  await loadBoatData();
  showNotice(allYears ? 'Alle Logbuch- und Kostendaten wurden gelöscht.' : `Die Daten aus ${scope} wurden gelöscht.`);
}

async function saveWeatherLocation(event) {
  event.preventDefault();
  if (state.role !== 'owner') return showNotice('Nur der Kapitän kann den Wetterort ändern.', 'danger');
  const button = event.currentTarget.querySelector('button');
  const query = element('weatherLocation').value.trim();
  if (!query) return;
  setBusy(button, true, 'Ort wird gesucht…');
  try {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=de&format=json`);
    if (!response.ok) throw new Error('Der Wetterort konnte nicht gesucht werden.');
    const result = (await response.json()).results?.[0];
    if (!result) throw new Error('Kein passender Wetterort gefunden.');
    const location = [result.name, result.admin1, result.country].filter((value, index, values) => value && values.indexOf(value) === index).join(', ');
    const values = { weather_location: location, weather_lat: result.latitude, weather_lon: result.longitude };
    const { error } = await state.client.from('boats').update(values).eq('id', state.boat.id);
    if (error) {
      if (error.code === '42703') throw new Error('Wetterort ist noch nicht eingerichtet. Bitte zuerst Migration 004 ausführen.');
      throw error;
    }
    Object.assign(state.boat, { weatherLocation: location, weatherLat: result.latitude, weatherLon: result.longitude });
    const savedBoat = state.boats.find(boat => boat.id === state.boat.id);
    if (savedBoat) Object.assign(savedBoat, state.boat);
    renderWeatherSettings();
    showNotice(`Wetterort gespeichert: ${location}.`);
  } catch (error) {
    showNotice(error.message || 'Wetterort konnte nicht gespeichert werden.', 'danger');
  } finally {
    setBusy(button, false, 'Speichern');
  }
}

async function loadCurrentWeather() {
  const requestId = ++state.weatherRequestId;
  const status = element('weatherAutoStatus');
  status.textContent = `Wetter für ${state.boat.weatherLocation || defaultWeatherLocation} wird geladen…`;
  try {
    const latitude = state.boat.weatherLat || defaultWeatherCoordinates.lat;
    const longitude = state.boat.weatherLon || defaultWeatherCoordinates.lon;
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&current=temperature_2m,weather_code,wind_speed_10m&wind_speed_unit=kmh&timezone=auto`);
    if (!response.ok) throw new Error('Wetterdaten nicht verfügbar.');
    const current = (await response.json()).current;
    if (!current || requestId !== state.weatherRequestId || element('tripId').value) return;
    if (!element('tripWeather').value) element('tripWeather').value = weatherDescriptions[current.weather_code] || 'Unbekannt';
    if (!element('tripTemperature').value) element('tripTemperature').value = current.temperature_2m;
    if (!element('tripWind').value) element('tripWind').value = current.wind_speed_10m;
    status.textContent = `Wetter automatisch übernommen · ${state.boat.weatherLocation || defaultWeatherLocation}`;
  } catch (_) {
    if (requestId === state.weatherRequestId) status.textContent = 'Wetterdaten konnten nicht automatisch geladen werden.';
  }
}

async function loadCurrentWaterTemperature() {
  const requestId = ++state.waterTemperatureRequestId;
  const status = element('waterTemperatureAutoStatus');
  status.textContent = 'Wassertemperatur wird geladen…';
  try {
    const response = await fetch('/api/water-temperature', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !Number.isFinite(Number(data.temperature_c))) throw new Error(data.error || 'Wassertemperatur nicht verfügbar.');
    if (requestId !== state.waterTemperatureRequestId || element('tripId').value) return;
    if (!element('tripWaterTemperature').value) element('tripWaterTemperature').value = data.temperature_c;
    status.innerHTML = `Wassertemperatur automatisch übernommen · <a href="${escapeHtml(data.source_url)}" target="_blank" rel="noreferrer">${escapeHtml(data.source)}</a> (modelliert) · ${escapeHtml(data.lake)}, ${data.depth_m} m Tiefe`;
  } catch (_) {
    if (requestId === state.waterTemperatureRequestId) status.textContent = 'Wassertemperatur konnte nicht automatisch geladen werden.';
  }
}

function resetTripForm(show, withWeather = true) {
  element('tripForm').classList.toggle('d-none', !show);
  if (!show) {
    state.weatherRequestId += 1;
    state.waterTemperatureRequestId += 1;
    element('tripForm').reset();
    element('tripId').value = '';
    element('tripEngineHint').textContent = '';
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
  updateEngineHint();
  setWine(0);
  element('weatherAutoStatus').textContent = '';
  element('waterTemperatureAutoStatus').textContent = '';
  if (withWeather) {
    loadCurrentWeather();
    loadCurrentWaterTemperature();
  }
  element('tripForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveTrip(event) {
  event.preventDefault();
  const id = element('tripId').value;
  const engineStart = numberOrZero(element('tripEngineStart').value);
  const engineEnd = numberOrZero(element('tripEngineEnd').value);
  if (engineEnd < engineStart) return showNotice('Der Motor-Endstand darf nicht kleiner als der Startstand sein.', 'danger');
  const values = {
    boat_id: state.boat.id, start_at: new Date(element('tripStart').value).toISOString(), end_at: new Date(element('tripEnd').value).toISOString(),
    engine_start: engineStart, engine_end: engineEnd,
    wine_bottles: Number(element('tripWine').value) || 0, remarks: element('tripRemarks').value.trim(), weather: element('tripWeather').value.trim() || null,
    temperature_c: element('tripTemperature').value === '' ? null : numberOrZero(element('tripTemperature').value),
    water_temperature_c: element('tripWaterTemperature').value === '' ? null : numberOrZero(element('tripWaterTemperature').value),
    wind_kmh: element('tripWind').value === '' ? null : numberOrZero(element('tripWind').value)
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
  resetTripForm(true, false); element('tripId').value = trip.id;
  element('tripStart').value = localDateTime(trip.start_at); element('tripEnd').value = localDateTime(trip.end_at); element('tripEngineStart').value = trip.engine_start; element('tripEngineEnd').value = trip.engine_end; setWine(trip.wine_bottles); element('tripRemarks').value = trip.remarks || ''; element('tripWeather').value = trip.weather || ''; element('tripTemperature').value = trip.temperature_c ?? ''; element('tripWaterTemperature').value = trip.water_temperature_c ?? ''; element('tripWind').value = trip.wind_kmh ?? '';
  updateEngineHint();
};

function formatTripDateTime(value) {
  return new Date(value).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' });
}

window.showTripDetails = id => {
  const trip = state.trips.find(item => item.id === id);
  if (!trip) return;
  const durationHours = Math.max(0, new Date(trip.end_at) - new Date(trip.start_at)) / 3600000;
  const engineHours = numberOrZero(trip.engine_end) - numberOrZero(trip.engine_start);
  const weather = [
    trip.weather,
    trip.temperature_c !== null && trip.temperature_c !== undefined ? `${trip.temperature_c} °C` : '',
    trip.wind_kmh !== null && trip.wind_kmh !== undefined ? `${trip.wind_kmh} km/h Wind` : ''
  ].filter(Boolean).map(escapeHtml).join(' · ') || '–';
  const waterTemperature = trip.water_temperature_c !== null && trip.water_temperature_c !== undefined ? `${trip.water_temperature_c} °C` : '–';
  element('tripDetailTitle').textContent = `Ausflug vom ${new Date(trip.start_at).toLocaleDateString('de-CH')}`;
  element('tripDetailContent').innerHTML = `<dl class="row mb-0 trip-detail-list">
    <dt class="col-5">Start</dt><dd class="col-7">${formatTripDateTime(trip.start_at)}</dd>
    <dt class="col-5">Ende</dt><dd class="col-7">${formatTripDateTime(trip.end_at)}</dd>
    <dt class="col-5">Zeit auf See</dt><dd class="col-7">${durationHours.toFixed(1).replace('.', ',')} h</dd>
    <dt class="col-5">Motor</dt><dd class="col-7">${numberOrZero(trip.engine_start).toFixed(1).replace('.', ',')} → ${numberOrZero(trip.engine_end).toFixed(1).replace('.', ',')} h <span class="text-secondary">(+${engineHours.toFixed(1).replace('.', ',')} h)</span></dd>
    <dt class="col-5">Wein</dt><dd class="col-7">${trip.wine_bottles ? `${trip.wine_bottles} ${trip.wine_bottles === 1 ? 'Flasche' : 'Flaschen'}` : '–'}</dd>
    <dt class="col-5">Wetter</dt><dd class="col-7">${weather}</dd>
    <dt class="col-5">Wassertemperatur</dt><dd class="col-7">${waterTemperature}</dd>
    <dt class="col-12 mt-2">Bemerkungen</dt><dd class="col-12 mb-0">${trip.remarks ? escapeHtml(trip.remarks).replace(/\n/g, '<br>') : '<span class="text-secondary">Keine Bemerkungen</span>'}</dd>
  </dl>`;
  element('tripDetailEditButton').dataset.tripId = id;
  bootstrap.Modal.getOrCreateInstance(element('tripDetailModal')).show();
};

function editTripFromDetail(event) {
  const id = event.currentTarget.dataset.tripId;
  if (!id) return;
  bootstrap.Modal.getOrCreateInstance(element('tripDetailModal')).hide();
  window.setTimeout(() => window.editTrip(id), 150);
}
window.deleteTrip = async id => { if (!confirm('Diesen Ausflug wirklich löschen?')) return; const { error } = await state.client.from('trips').delete().eq('id', id); if (error) return showNotice(error.message, 'danger'); await loadBoatData(); showNotice('Ausflug gelöscht.'); };

function participantName(userId) {
  const person = [...state.costParticipants, ...state.boatMembers].find(item => item.user_id === userId);
  return person?.profiles?.display_name || person?.profiles?.email || (userId === state.user?.id ? state.profile?.display_name || state.profile?.email : 'Unbekannte Person');
}

function costSharesFor(costId) { return state.costShares.filter(share => share.cost_id === costId); }
function isSharedCost(costId) { return costSharesFor(costId).length > 0; }

function renderCosts() {
  const costs = currentCosts();
  element('costList').innerHTML = costs.length ? costs.map(cost => {
    const sharing = isSharedCost(cost.id) ? `<div class="small text-secondary mt-1"><i class="bi bi-people me-1"></i>Geteilt${cost.paid_by ? ` · bezahlt von ${escapeHtml(participantName(cost.paid_by))}` : ''}</div>` : '';
    return `<div class="swipe-entry" data-delete-kind="cost" data-delete-id="${cost.id}"><button class="swipe-delete-action" type="button" data-swipe-delete aria-label="Kostenposten löschen"><i class="bi bi-trash3"></i><span>Löschen</span></button><article class="card entry-card"><div class="card-body py-3"><div class="d-flex justify-content-between gap-2"><div><strong>${escapeHtml(cost.category)}</strong><div class="small text-secondary">${new Date(`${cost.cost_date}T12:00`).toLocaleDateString('de-CH')}${cost.description ? ` · ${escapeHtml(cost.description)}` : ''}</div>${sharing}</div><div class="text-end"><div class="entry-value">${formatCurrency(cost.amount_chf)}</div><button class="btn btn-link btn-sm p-0" onclick="editCost('${cost.id}')" aria-label="Bearbeiten"><i class="bi bi-pencil-square"></i></button><button class="btn btn-link btn-sm p-0 ms-2 text-danger" onclick="deleteCost('${cost.id}')" aria-label="Löschen"><i class="bi bi-trash"></i></button></div></div></div></article></div>`;
  }).join('') : '<div class="empty-state">Für dieses Jahr sind noch keine Kosten erfasst.</div>';
  showCostsView(state.costsViewMode, false);
}

function showCostsView(mode, render = true) {
  state.costsViewMode = mode;
  const sharing = mode === 'sharing';
  element('costEntriesPanel').classList.toggle('d-none', sharing);
  element('costSharingPanel').classList.toggle('d-none', !sharing);
  element('showCostEntries').classList.toggle('active', !sharing);
  element('showCostSharing').classList.toggle('active', sharing);
  if (sharing && render) renderCostSharing();
}

function renderCostShareFormOptions({ paidBy = '', participantIds = [] } = {}) {
  const participants = state.costParticipants;
  const fallbackPaidBy = paidBy || participants.find(person => person.user_id === state.user.id)?.user_id || participants[0]?.user_id || '';
  element('costPaidBy').innerHTML = participants.map(person => `<option value="${person.user_id}"${person.user_id === fallbackPaidBy ? ' selected' : ''}>${escapeHtml(participantName(person.user_id))}</option>`).join('');
  const selected = participantIds.length ? new Set(participantIds) : new Set(participants.map(person => person.user_id));
  element('costShareParticipantOptions').innerHTML = participants.map(person => `<label class="form-check cost-share-person"><input class="form-check-input" type="checkbox" name="costShareParticipant" value="${person.user_id}"${selected.has(person.user_id) ? ' checked' : ''}><span class="form-check-label">${escapeHtml(participantName(person.user_id))}</span></label>`).join('');
}

function updateCostSharingFields() {
  const enabled = state.costSharingAvailable && state.costParticipants.length > 0;
  element('costSharingFields').classList.toggle('d-none', !enabled);
  if (!enabled) {
    element('costShared').checked = false;
    element('costShareDetails').classList.add('d-none');
    return;
  }
  element('costShareDetails').classList.toggle('d-none', !element('costShared').checked);
}

function updateFuelFields() { document.querySelectorAll('.fuel-only').forEach(field => field.classList.toggle('d-none', element('costCategory').value !== 'Treibstoff')); }
function resetCostForm(show) {
  element('costForm').classList.toggle('d-none', !show);
  if (!show) {
    element('costForm').reset();
    element('costId').value = '';
    updateCostSharingFields();
    return;
  }
  element('costForm').reset();
  element('costId').value = '';
  element('costDate').value = new Date().toISOString().slice(0, 10);
  renderCostShareFormOptions();
  element('costShared').checked = state.costSharingAvailable && state.costParticipants.length > 0;
  updateFuelFields();
  updateCostSharingFields();
  element('costForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveCost(event) {
  event.preventDefault();
  const id = element('costId').value;
  const isFuel = element('costCategory').value === 'Treibstoff';
  const shared = state.costSharingAvailable && state.costParticipants.length > 0 && element('costShared').checked;
  const shareParticipants = shared ? [...document.querySelectorAll('input[name="costShareParticipant"]:checked')].map(input => input.value) : [];
  if (shared && !shareParticipants.length) return showNotice('Wähle mindestens eine beteiligte Person aus.', 'warning');
  const values = {
    boat_id: state.boat.id,
    cost_date: element('costDate').value,
    category: element('costCategory').value,
    description: element('costDescription').value.trim(),
    amount_chf: numberOrZero(element('costAmount').value),
    litres: isFuel && element('costLitres').value !== '' ? numberOrZero(element('costLitres').value) : null,
    price_per_litre: isFuel && element('costPrice').value !== '' ? numberOrZero(element('costPrice').value) : null
  };
  if (state.costSharingAvailable) values.paid_by = shared ? element('costPaidBy').value : null;
  if (!id) values.created_by = state.user.id;
  const request = id ? state.client.from('costs').update(values).eq('id', id).select().single() : state.client.from('costs').insert(values).select().single();
  const { data: savedCost, error } = await request;
  if (error) return showNotice(error.message, 'danger');
  if (state.costSharingAvailable) {
    const { error: deleteError } = await state.client.from('cost_shares').delete().eq('cost_id', savedCost.id);
    if (deleteError) return showNotice(`Kosten gespeichert, Anteile konnten nicht aktualisiert werden: ${deleteError.message}`, 'danger');
    if (shared) {
      const shareAmount = values.amount_chf / shareParticipants.length;
      const { error: sharesError } = await state.client.from('cost_shares').insert(shareParticipants.map(userId => ({ cost_id: savedCost.id, user_id: userId, share_amount: shareAmount })));
      if (sharesError) return showNotice(`Kosten gespeichert, Anteile konnten nicht gespeichert werden: ${sharesError.message}`, 'danger');
    }
  }
  resetCostForm(false);
  await loadBoatData();
  showNotice(id ? 'Kosten aktualisiert.' : 'Kosten gespeichert.');
}

window.editCost = id => {
  const cost = state.costs.find(item => item.id === id);
  if (!cost) return;
  resetCostForm(true);
  element('costId').value = cost.id;
  element('costDate').value = cost.cost_date;
  element('costCategory').value = cost.category;
  element('costDescription').value = cost.description || '';
  element('costAmount').value = cost.amount_chf;
  element('costLitres').value = cost.litres ?? '';
  element('costPrice').value = cost.price_per_litre ?? '';
  const shares = costSharesFor(cost.id);
  renderCostShareFormOptions({ paidBy: cost.paid_by || '', participantIds: shares.map(share => share.user_id) });
  element('costShared').checked = shares.length > 0;
  updateFuelFields();
  updateCostSharingFields();
};
window.deleteCost = async id => { if (!confirm('Diesen Kostenposten wirklich löschen?')) return; const { error } = await state.client.from('costs').delete().eq('id', id); if (error) return showNotice(error.message, 'danger'); await loadBoatData(); showNotice('Kosten gelöscht.'); };

function roundMoney(value) { return Math.round((Number(value) || 0) * 100) / 100; }

function calculateCostBalances() {
  const balances = new Map(state.costParticipants.map(person => [person.user_id, { userId: person.user_id, paid: 0, share: 0, sent: 0, received: 0, balance: 0 }]));
  currentCosts().forEach(cost => {
    const shares = costSharesFor(cost.id);
    if (!shares.length) return;
    if (cost.paid_by && balances.has(cost.paid_by)) balances.get(cost.paid_by).paid += numberOrZero(cost.amount_chf);
    shares.forEach(share => {
      if (balances.has(share.user_id)) balances.get(share.user_id).share += numberOrZero(share.share_amount);
    });
  });
  state.costSettlements.filter(settlement => dateYear(settlement.settlement_date) === state.selectedYear).forEach(settlement => {
    if (balances.has(settlement.from_user_id)) balances.get(settlement.from_user_id).sent += numberOrZero(settlement.amount_chf);
    if (balances.has(settlement.to_user_id)) balances.get(settlement.to_user_id).received += numberOrZero(settlement.amount_chf);
  });
  return [...balances.values()].map(item => ({ ...item, balance: item.paid + item.sent - item.received - item.share }));
}

function suggestedSettlements(balances) {
  const creditors = balances.filter(item => item.balance > 0.004).map(item => ({ ...item, open: roundMoney(item.balance) }));
  const debtors = balances.filter(item => item.balance < -0.004).map(item => ({ ...item, open: roundMoney(-item.balance) }));
  const suggestions = [];
  let creditorIndex = 0;
  let debtorIndex = 0;
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = roundMoney(Math.min(creditor.open, debtor.open));
    if (amount < 0.01) break;
    suggestions.push({ from: debtor.userId, to: creditor.userId, amount });
    creditor.open = roundMoney(creditor.open - amount);
    debtor.open = roundMoney(debtor.open - amount);
    if (creditor.open < 0.01) creditorIndex += 1;
    if (debtor.open < 0.01) debtorIndex += 1;
  }
  return suggestions;
}

function renderCostSharing() {
  const unavailable = !state.costSharingAvailable;
  element('costSharingUnavailable').classList.toggle('d-none', !unavailable);
  element('costSharingContent').classList.toggle('d-none', unavailable);
  if (unavailable) return;
  const isOwner = state.role === 'owner';
  const selected = new Set(state.costParticipants.map(person => person.user_id));
  element('costParticipantMembers').innerHTML = state.boatMembers.length ? state.boatMembers.map(member => `<label class="form-check cost-share-person"><input class="form-check-input" type="checkbox" name="costParticipant" value="${member.user_id}"${selected.has(member.user_id) ? ' checked' : ''}${isOwner ? '' : ' disabled'}><span class="form-check-label">${escapeHtml(participantName(member.user_id))}<small class="text-secondary d-block">${member.role === 'owner' ? 'Kapitän' : 'Crew'}</small></span></label>`).join('') : '<div class="empty-state py-2">Noch keine Bootsmitglieder vorhanden.</div>';
  element('saveCostParticipants').classList.toggle('d-none', !isOwner);
  element('costParticipantsHint').textContent = isOwner
    ? 'Diese Personen werden bei neuen geteilten Kosten standardmässig berücksichtigt. Bestehende Abrechnungen bleiben unverändert.'
    : 'Die Kostenbeteiligten werden vom Kapitän verwaltet. Bestehende Abrechnungen bleiben unverändert.';
  element('costSharingYear').textContent = state.selectedYear;
  const sharedCostTotal = currentCosts().filter(cost => isSharedCost(cost.id)).reduce((total, cost) => total + numberOrZero(cost.amount_chf), 0);
  element('costSharingTotal').textContent = `Gemeinsame Kosten: ${formatCurrency(sharedCostTotal)}`;
  const hasParticipants = state.costParticipants.length > 0;
  const balances = calculateCostBalances();
  element('costBalanceList').innerHTML = hasParticipants ? balances.map(item => {
    const status = item.balance > 0.004 ? `<span class="text-success">Erhält ${formatCurrency(item.balance)}</span>` : item.balance < -0.004 ? `<span class="text-danger">Zahlt ${formatCurrency(-item.balance)}</span>` : '<span class="text-success">Ausgeglichen</span>';
    return `<article class="cost-balance"><div><strong>${escapeHtml(participantName(item.userId))}</strong><div class="small text-secondary">Anteil ${formatCurrency(item.share)} · bezahlt ${formatCurrency(item.paid)}</div></div><strong>${status}</strong></article>`;
  }).join('') : '<div class="empty-state py-2">Lege zuerst die Kostenbeteiligten fest.</div>';
  const suggestions = suggestedSettlements(balances);
  element('settlementSuggestionCard').classList.toggle('d-none', !suggestions.length);
  element('settlementSuggestions').innerHTML = suggestions.map(suggestion => `<div class="cost-settlement-suggestion"><span><strong>${escapeHtml(participantName(suggestion.from))}</strong> <i class="bi bi-arrow-right mx-1"></i> <strong>${escapeHtml(participantName(suggestion.to))}</strong><small class="d-block text-secondary">${formatCurrency(suggestion.amount)}</small></span><button class="btn btn-outline-primary btn-sm" type="button" onclick="useSettlementSuggestion('${suggestion.from}', '${suggestion.to}', ${suggestion.amount})">Übernehmen</button></div>`).join('');
  const optionMarkup = state.costParticipants.map(person => `<option value="${person.user_id}">${escapeHtml(participantName(person.user_id))}</option>`).join('');
  element('settlementFrom').innerHTML = optionMarkup;
  element('settlementTo').innerHTML = optionMarkup;
  if (!element('settlementDate').value) element('settlementDate').value = new Date().toISOString().slice(0, 10);
  const canSettle = state.costParticipants.length >= 2;
  element('settlementForm').classList.toggle('d-none', !canSettle);
  const settlements = state.costSettlements.filter(settlement => dateYear(settlement.settlement_date) === state.selectedYear);
  element('settlementList').innerHTML = settlements.length ? settlements.map(settlement => `<article class="cost-settlement"><div><strong>${escapeHtml(participantName(settlement.from_user_id))}</strong> <i class="bi bi-arrow-right mx-1"></i> <strong>${escapeHtml(participantName(settlement.to_user_id))}</strong><div class="small text-secondary">${new Date(`${settlement.settlement_date}T12:00`).toLocaleDateString('de-CH')}${settlement.note ? ` · ${escapeHtml(settlement.note)}` : ''}</div></div><div class="text-end"><strong>${formatCurrency(settlement.amount_chf)}</strong><button class="btn btn-link btn-sm p-0 d-block ms-auto text-danger" type="button" onclick="deleteSettlement('${settlement.id}')">Löschen</button></div></article>`).join('') : '<div class="empty-state py-2">Noch keine Ausgleichszahlungen in diesem Jahr.</div>';
}

async function saveCostParticipants(event) {
  event.preventDefault();
  if (state.role !== 'owner') return showNotice('Nur der Kapitän kann Kostenbeteiligte verwalten.', 'danger');
  const selected = new Set([...document.querySelectorAll('input[name="costParticipant"]:checked')].map(input => input.value));
  const current = new Set(state.costParticipants.map(person => person.user_id));
  const add = [...selected].filter(userId => !current.has(userId));
  const remove = [...current].filter(userId => !selected.has(userId));
  const button = element('saveCostParticipants');
  setBusy(button, true, 'Wird gespeichert…');
  try {
    if (add.length) {
      const { error } = await state.client.from('boat_cost_participants').insert(add.map(userId => ({ boat_id: state.boat.id, user_id: userId })));
      if (error) throw error;
    }
    if (remove.length) {
      const { error } = await state.client.from('boat_cost_participants').delete().eq('boat_id', state.boat.id).in('user_id', remove);
      if (error) throw error;
    }
    await loadBoatData();
    showCostsView('sharing');
    showNotice('Kostenbeteiligte gespeichert.');
  } catch (error) {
    showNotice(error.message || 'Kostenbeteiligte konnten nicht gespeichert werden.', 'danger');
  } finally {
    setBusy(button, false, 'Kostenbeteiligte speichern');
  }
}

window.useSettlementSuggestion = (from, to, amount) => {
  element('settlementFrom').value = from;
  element('settlementTo').value = to;
  element('settlementAmount').value = Number(amount).toFixed(2);
  element('settlementForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

async function saveSettlement(event) {
  event.preventDefault();
  const from = element('settlementFrom').value;
  const to = element('settlementTo').value;
  if (from === to) return showNotice('Von und An müssen unterschiedliche Personen sein.', 'warning');
  const amount = numberOrZero(element('settlementAmount').value);
  if (amount <= 0) return showNotice('Bitte einen Betrag grösser als CHF 0 eingeben.', 'warning');
  const button = event.currentTarget.querySelector('button[type="submit"]');
  setBusy(button, true, 'Wird gespeichert…');
  const { error } = await state.client.from('cost_settlements').insert({ boat_id: state.boat.id, settlement_date: element('settlementDate').value, from_user_id: from, to_user_id: to, amount_chf: amount, note: element('settlementNote').value.trim(), created_by: state.user.id });
  setBusy(button, false, 'Ausgleich speichern');
  if (error) return showNotice(error.message, 'danger');
  element('settlementAmount').value = '';
  element('settlementNote').value = '';
  await loadBoatData();
  showCostsView('sharing');
  showNotice('Ausgleichszahlung gespeichert.');
}

window.deleteSettlement = async id => {
  if (!confirm('Diese Ausgleichszahlung wirklich löschen?')) return;
  const { error } = await state.client.from('cost_settlements').delete().eq('id', id).eq('boat_id', state.boat.id);
  if (error) return showNotice(error.message, 'danger');
  await loadBoatData();
  showCostsView('sharing');
  showNotice('Ausgleichszahlung gelöscht.');
};

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
  element('invitationList').innerHTML = isOwner && invitations?.length ? `<div class="small text-secondary mt-2">Offene Einladungen</div>${invitations.map(invitation => `<article class="card entry-card"><div class="card-body py-3"><strong>${escapeHtml(invitation.email)}</strong><div class="small text-secondary mt-1">Gültig bis ${new Date(invitation.expires_at).toLocaleDateString('de-CH')}</div><div class="d-flex flex-wrap gap-2 mt-2"><button class="btn btn-outline-primary btn-sm" onclick="copyInvitation('${invitation.token}')"><i class="bi bi-link-45deg me-1"></i>Einladungslink kopieren</button><button class="btn btn-outline-danger btn-sm" onclick="revokeInvitation('${invitation.id}')"><i class="bi bi-x-circle me-1"></i>Zurückziehen</button></div></div></article>`).join('')}` : '';
}

async function createInvitation(event) {
  event.preventDefault();
  const email = element('inviteEmail').value.trim().toLowerCase();
  const { error } = await state.client.from('boat_invitations').insert({ boat_id: state.boat.id, email, invited_by: state.user.id });
  if (error) return showNotice(error.message, 'danger');
  element('inviteEmail').value = ''; await renderCrew(); showNotice('Einladung erstellt. Kopiere nun den Einladungslink.');
}
window.copyInvitation = async token => { const link = `${window.location.origin}${window.location.pathname}?invite=${token}`; try { await navigator.clipboard.writeText(link); showNotice('Einladungslink kopiert.', 'success', { force: true }); } catch (_) { window.prompt('Einladungslink kopieren:', link); } };
window.revokeInvitation = async id => {
  if (state.role !== 'owner') return showNotice('Nur der Kapitän kann Einladungen zurückziehen.', 'danger');
  if (!confirm('Diese Einladung wirklich zurückziehen? Der bisherige Einladungslink wird sofort ungültig.')) return;
  const { error } = await state.client.from('boat_invitations').delete().eq('id', id).eq('boat_id', state.boat.id).is('accepted_at', null);
  if (error) return showNotice(error.message, 'danger');
  await renderCrew();
  showNotice('Einladung zurückgezogen.');
};
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

function requireOwnerForBackup() {
  if (state.role === 'owner') return true;
  showNotice('Nur der Kapitän kann Sicherungen exportieren oder importieren.', 'danger');
  return false;
}

function safeFilename(value) { return String(value || 'Boot').trim().replace(/[^a-z0-9äöüß_-]+/gi, '_'); }
function excelDateTime(value) { return localDateTime(value).replace('T', ' '); }
function addExcelSheet(workbook, name, headers, rows, widths) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet['!cols'] = widths.map(width => ({ wch: width }));
  XLSX.utils.book_append_sheet(workbook, worksheet, name);
}

function participantEmail(userId) {
  const person = [...state.costParticipants, ...state.boatMembers, ...state.costShares].find(item => item.user_id === userId);
  return String(person?.profiles?.email || '').trim().toLowerCase();
}

function exportExcel() {
  if (!requireOwnerForBackup()) return;
  if (!window.XLSX) return showNotice('Die Excel-Bibliothek konnte nicht geladen werden. Bitte versuche es erneut.', 'danger');
  const workbook = XLSX.utils.book_new();
  addExcelSheet(workbook, 'Ausflüge', ['Start', 'Ende', 'Motor Start', 'Motor Ende', 'Wein', 'Bemerkungen', 'Wetter', 'Temperatur', 'Wassertemperatur', 'Wind'], state.trips.map(trip => [
    excelDateTime(trip.start_at), excelDateTime(trip.end_at), Number(trip.engine_start), Number(trip.engine_end), Number(trip.wine_bottles), trip.remarks || '', trip.weather || '', trip.temperature_c ?? '', trip.water_temperature_c ?? '', trip.wind_kmh ?? ''
  ]), [19, 19, 13, 13, 8, 45, 24, 13, 18, 12]);
  const costHeaders = state.costSharingAvailable
    ? ['Backup-Kosten-ID', 'Datum', 'Kategorie', 'Beschreibung', 'Betrag (CHF)', 'Liter', 'Preis/Liter', 'Bezahlt von (E-Mail)']
    : ['Datum', 'Kategorie', 'Beschreibung', 'Betrag (CHF)', 'Liter', 'Preis/Liter'];
  const sharingUserIds = new Set([
    ...state.costParticipants.map(person => person.user_id),
    ...state.costs.map(cost => cost.paid_by).filter(Boolean),
    ...state.costShares.map(share => share.user_id),
    ...state.costSettlements.flatMap(settlement => [settlement.from_user_id, settlement.to_user_id])
  ]);
  const missingEmails = [...sharingUserIds].filter(userId => !participantEmail(userId));
  if (state.costSharingAvailable && missingEmails.length) {
    return showNotice('Die Sicherung kann nicht vollständig erstellt werden, weil mindestens eine historische beteiligte Person nicht mehr zugeordnet werden kann.', 'danger');
  }
  addExcelSheet(workbook, 'Kosten', costHeaders, state.costs.map(cost => {
    const values = [cost.cost_date, cost.category, cost.description || '', Number(cost.amount_chf), cost.litres ?? '', cost.price_per_litre ?? ''];
    return state.costSharingAvailable ? [cost.id, ...values, cost.paid_by ? participantEmail(cost.paid_by) : ''] : values;
  }), state.costSharingAvailable ? [38, 14, 18, 42, 16, 12, 14, 34] : [14, 18, 42, 16, 12, 14]);
  if (state.costSharingAvailable) {
    addExcelSheet(workbook, 'Kostenbeteiligte', ['E-Mail', 'Name'], state.costParticipants.map(person => [participantEmail(person.user_id), person.profiles?.display_name || '']), [34, 30]);
    addExcelSheet(workbook, 'Kostenanteile', ['Backup-Kosten-ID', 'E-Mail', 'Anteil (CHF)'], state.costShares.map(share => [share.cost_id, participantEmail(share.user_id), Number(share.share_amount)]), [38, 34, 16]);
    addExcelSheet(workbook, 'Ausgleichszahlungen', ['Datum', 'Von (E-Mail)', 'An (E-Mail)', 'Betrag (CHF)', 'Bemerkung'], state.costSettlements.map(settlement => [
      settlement.settlement_date, participantEmail(settlement.from_user_id), participantEmail(settlement.to_user_id), Number(settlement.amount_chf), settlement.note || ''
    ]), [14, 34, 34, 16, 42]);
  }
  XLSX.writeFile(workbook, `Bootslogbuch_${safeFilename(state.boat.name)}_Sicherung.xlsx`, { compression: true });
  showNotice('Excel-Sicherung heruntergeladen.', 'success', { force: true });
}

function normaliseImportHeader(value) {
  return String(value ?? '').trim().toLocaleLowerCase('de-CH').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
}
function importValue(row, aliases) {
  const normalized = Object.entries(row).find(([key]) => aliases.includes(normaliseImportHeader(key)));
  return normalized ? normalized[1] : null;
}
function hasImportValue(value) { return value !== null && value !== undefined && String(value).trim() !== ''; }
function importNumber(value, label, required = false) {
  if (!hasImportValue(value)) {
    if (required) throw new Error(`${label} fehlt.`);
    return null;
  }
  const compact = String(value).replace(/[’'\s]/g, '');
  const normalized = compact.includes(',') ? compact.replace(/\./g, '').replace(',', '.') : compact;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`${label} ist ungültig.`);
  return parsed;
}
function importDateTime(value, label) {
  let date;
  if (value instanceof Date) date = value;
  else if (typeof value === 'number' && window.XLSX?.SSF) {
    const parts = XLSX.SSF.parse_date_code(value);
    if (parts) date = new Date(parts.y, parts.m - 1, parts.d, parts.H || 0, parts.M || 0, Math.floor(parts.S || 0));
  }
  else {
    const raw = String(value ?? '').trim();
    const swiss = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?$/);
    if (swiss) date = new Date(Number(swiss[3]), Number(swiss[2]) - 1, Number(swiss[1]), Number(swiss[4] || 0), Number(swiss[5] || 0));
    else date = new Date(raw.replace(' ', 'T'));
  }
  if (Number.isNaN(date?.getTime())) throw new Error(`${label} ist kein gültiges Datum.`);
  return date.toISOString();
}
function importCostDate(value, label) {
  if (value instanceof Date) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  if (typeof value === 'number' && window.XLSX?.SSF) {
    const parts = XLSX.SSF.parse_date_code(value);
    if (parts) return `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`;
  }
  const raw = String(value ?? '').trim();
  const swiss = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (swiss) return `${swiss[3]}-${String(swiss[2]).padStart(2, '0')}-${String(swiss[1]).padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  throw new Error(`${label} ist kein gültiges Datum.`);
}
function importEmail(value, label, required = true) {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email && !required) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`${label} enthält keine gültige E-Mail-Adresse.`);
  return email;
}
function parseImportedTrips(rows) {
  return rows.map((row, index) => {
    const prefix = `Ausflüge, Zeile ${index + 2}`;
    const startAt = importDateTime(importValue(row, ['start', 'startdatumzeit']), `${prefix}: Start`);
    const endAt = importDateTime(importValue(row, ['ende', 'endedatumzeit']), `${prefix}: Ende`);
    const engineStart = importNumber(importValue(row, ['motorstart']), `${prefix}: Motor Start`, true);
    const engineEnd = importNumber(importValue(row, ['motorende']), `${prefix}: Motor Ende`, true);
    const wine = importNumber(importValue(row, ['wein']), `${prefix}: Wein`) ?? 0;
    if (new Date(endAt) < new Date(startAt)) throw new Error(`${prefix}: Ende liegt vor dem Start.`);
    if (engineEnd < engineStart) throw new Error(`${prefix}: Motor Ende liegt unter Motor Start.`);
    if (wine < 0 || wine > 99) throw new Error(`${prefix}: Wein muss zwischen 0 und 99 liegen.`);
    return {
      start_at: startAt, end_at: endAt, engine_start: engineStart, engine_end: engineEnd, wine_bottles: wine,
      remarks: String(importValue(row, ['bemerkungen', 'bemerkung']) ?? '').trim(),
      weather: String(importValue(row, ['wetter']) ?? '').trim() || null,
      temperature_c: importNumber(importValue(row, ['temperatur', 'temp']), `${prefix}: Temperatur`),
      water_temperature_c: importNumber(importValue(row, ['wassertemperatur', 'wassertemp']), `${prefix}: Wassertemperatur`),
      wind_kmh: importNumber(importValue(row, ['wind', 'windkmh']), `${prefix}: Wind`)
    };
  });
}
function parseImportedCosts(rows) {
  return rows.map((row, index) => {
    const prefix = `Kosten, Zeile ${index + 2}`;
    const categoryValue = String(importValue(row, ['kategorie']) ?? '').trim();
    // Bereits exportierte Dateien mit der früheren Bezeichnung bleiben importierbar.
    const normalisedCategory = normaliseImportHeader(categoryValue) === 'benzin' ? 'Treibstoff' : categoryValue;
    const category = categories.find(item => normaliseImportHeader(item) === normaliseImportHeader(normalisedCategory));
    if (!category) throw new Error(`${prefix}: Kategorie ist ungültig.`);
    const amount = importNumber(importValue(row, ['betragchf', 'betrag']), `${prefix}: Betrag`, true);
    const litres = importNumber(importValue(row, ['liter', 'litres']), `${prefix}: Liter`);
    const price = importNumber(importValue(row, ['preisliter']), `${prefix}: Preis/Liter`);
    if (amount < 0 || litres !== null && litres < 0 || price !== null && price < 0) throw new Error(`${prefix}: Zahlen dürfen nicht negativ sein.`);
    return {
      cost_date: importCostDate(importValue(row, ['datum']), `${prefix}: Datum`), category,
      description: String(importValue(row, ['beschreibung']) ?? '').trim(), amount_chf: amount,
      litres: category === 'Treibstoff' ? litres : null, price_per_litre: category === 'Treibstoff' ? price : null,
      source_cost_id: String(importValue(row, ['backupkostenid', 'sourcecostid']) ?? '').trim(),
      paid_by_email: importEmail(importValue(row, ['bezahltvonemail', 'paidbyemail']), `${prefix}: Bezahlt von`, false)
    };
  });
}

function parseImportedCostParticipants(rows) {
  return rows.map((row, index) => ({
    email: importEmail(importValue(row, ['email']), `Kostenbeteiligte, Zeile ${index + 2}: E-Mail`)
  }));
}

function parseImportedCostShares(rows) {
  return rows.map((row, index) => {
    const prefix = `Kostenanteile, Zeile ${index + 2}`;
    const sourceCostId = String(importValue(row, ['backupkostenid', 'sourcecostid']) ?? '').trim();
    if (!sourceCostId) throw new Error(`${prefix}: Backup-Kosten-ID fehlt.`);
    const amount = importNumber(importValue(row, ['anteilchf', 'anteil']), `${prefix}: Anteil`, true);
    if (amount < 0) throw new Error(`${prefix}: Anteil darf nicht negativ sein.`);
    return { source_cost_id: sourceCostId, user_email: importEmail(importValue(row, ['email']), `${prefix}: E-Mail`), share_amount: amount };
  });
}

function parseImportedSettlements(rows) {
  return rows.map((row, index) => {
    const prefix = `Ausgleichszahlungen, Zeile ${index + 2}`;
    const amount = importNumber(importValue(row, ['betragchf', 'betrag']), `${prefix}: Betrag`, true);
    if (amount <= 0) throw new Error(`${prefix}: Betrag muss grösser als CHF 0 sein.`);
    const from = importEmail(importValue(row, ['vonemail', 'von']), `${prefix}: Von`);
    const to = importEmail(importValue(row, ['anemail', 'an']), `${prefix}: An`);
    if (from === to) throw new Error(`${prefix}: Von und An müssen unterschiedlich sein.`);
    return {
      settlement_date: importCostDate(importValue(row, ['datum']), `${prefix}: Datum`),
      from_email: from, to_email: to, amount_chf: amount,
      note: String(importValue(row, ['bemerkung', 'beschreibung']) ?? '').trim()
    };
  });
}

async function importExcel(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !requireOwnerForBackup()) return;
  if (!window.XLSX) return showNotice('Die Excel-Bibliothek konnte nicht geladen werden. Bitte versuche es erneut.', 'danger');
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const sheetByName = aliases => workbook.SheetNames.find(name => aliases.includes(normaliseImportHeader(name)));
    const tripsSheet = sheetByName(['ausfluege', 'logbuch']);
    const costsSheet = sheetByName(['kosten']);
    const participantsSheet = sheetByName(['kostenbeteiligte']);
    const sharesSheet = sheetByName(['kostenanteile']);
    const settlementsSheet = sheetByName(['ausgleichszahlungen']);
    if (!tripsSheet && !costsSheet) throw new Error('Die Excel-Datei benötigt mindestens den Tab „Ausflüge“ oder „Kosten“.');
    const trips = tripsSheet ? parseImportedTrips(XLSX.utils.sheet_to_json(workbook.Sheets[tripsSheet], { defval: null, raw: true })) : [];
    const costs = costsSheet ? parseImportedCosts(XLSX.utils.sheet_to_json(workbook.Sheets[costsSheet], { defval: null, raw: true })) : [];
    const participants = participantsSheet ? parseImportedCostParticipants(XLSX.utils.sheet_to_json(workbook.Sheets[participantsSheet], { defval: null, raw: true })) : [];
    const shares = sharesSheet ? parseImportedCostShares(XLSX.utils.sheet_to_json(workbook.Sheets[sharesSheet], { defval: null, raw: true })) : [];
    const settlements = settlementsSheet ? parseImportedSettlements(XLSX.utils.sheet_to_json(workbook.Sheets[settlementsSheet], { defval: null, raw: true })) : [];
    if (!trips.length && !costs.length) throw new Error('Die Excel-Datei enthält keine importierbaren Zeilen.');
    const hasCostSharingData = Boolean(participantsSheet || sharesSheet || settlementsSheet);
    if (hasCostSharingData && costs.some(cost => !cost.source_cost_id)) throw new Error('Für die Kostenaufteilung benötigt jeder Kostenposten eine Backup-Kosten-ID. Bitte verwende eine aktuelle Excel-Sicherung.');
    const sharingText = hasCostSharingData ? `, ${participants.length} Kostenbeteiligte, ${shares.length} Kostenanteile und ${settlements.length} Ausgleichszahlungen` : '';
    if (!confirm(`${trips.length} Ausflüge und ${costs.length} Kosten${sharingText} werden zu „${state.boat.name}“ hinzugefügt. Bestehende Daten bleiben erhalten. Die genannten Personen müssen bereits Crewmitglieder dieses Boots sein. Fortfahren?`)) return;
    const { error } = hasCostSharingData
      ? await state.client.rpc('import_boat_backup_full', { target_boat_id: state.boat.id, trip_rows: trips, cost_rows: costs, participant_rows: participants, share_rows: shares, settlement_rows: settlements })
      : await state.client.rpc('import_boat_backup', { target_boat_id: state.boat.id, trip_rows: trips, cost_rows: costs });
    if (error) {
      if (error.code === 'PGRST202') throw new Error(hasCostSharingData ? 'Der vollständige Datenimport ist noch nicht eingerichtet. Bitte zuerst die neueste Supabase-Migration ausführen.' : 'Der Datenimport ist noch nicht eingerichtet. Bitte zuerst Migration 006 im Supabase SQL Editor ausführen.');
      throw error;
    }
    await loadBoatData();
    showNotice(`${trips.length} Ausflüge und ${costs.length} Kosten${hasCostSharingData ? ' inklusive Kostenaufteilung' : ''} importiert.`);
  } catch (error) {
    showNotice(error.message || 'Die Excel-Datei konnte nicht importiert werden.', 'danger');
  }
}

function showView(view) { document.querySelectorAll('.app-view').forEach(section => section.classList.toggle('d-none', section.id !== `${view}View`)); document.querySelectorAll('#mainNav [data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view)); if (view === 'settings') { renderDashboardSettings(); renderCrew(); } }
function switchBoat() {
  if (state.boats.length < 2) return showNotice('Du bist aktuell nur Mitglied dieses Boots.');
  element('boatSwitchList').innerHTML = state.boats.map(boat => {
    const isCurrent = boat.id === state.boat.id;
    const role = boat.role === 'owner' ? 'Kapitän' : 'Crew';
    return `<button class="list-group-item list-group-item-action boat-switch-option${isCurrent ? ' active' : ''}" type="button" data-boat-id="${boat.id}"${isCurrent ? ' aria-current="true"' : ''}><span class="d-flex align-items-center gap-3"><i class="bi ${isCurrent ? 'bi-check-circle-fill' : 'bi-sailboat'} fs-5"></i><span class="text-start flex-grow-1"><strong class="d-block text-truncate">${escapeHtml(boat.name)}</strong><small>${isCurrent ? 'Aktuell geöffnet · ' : ''}${role}</small></span></span></button>`;
  }).join('');
  bootstrap.Modal.getOrCreateInstance(element('boatSwitchModal')).show();
}

function showCreateOwnBoatDialog() {
  element('ownBoatName').value = '';
  bootstrap.Modal.getOrCreateInstance(element('createOwnBoatModal')).show();
  window.setTimeout(() => element('ownBoatName').focus(), 150);
}

async function selectBoat(boatId) {
  const selectedBoat = state.boats.find(boat => boat.id === boatId);
  if (!selectedBoat || selectedBoat.id === state.boat.id) return;
  bootstrap.Modal.getOrCreateInstance(element('boatSwitchModal')).hide();
  state.boat = selectedBoat;
  state.role = selectedBoat.role;
  localStorage.setItem(`bootslogbuch.boat.${state.user.id}`, selectedBoat.id);
  await loadBoatData();
  showView('dashboard');
  showNotice(`Zu „${selectedBoat.name}“ gewechselt.`);
}
async function signOut() { await state.client.auth.signOut(); showNotice('Abgemeldet.'); }
function showScreen(id) { ['loadingScreen', 'loginScreen', 'setupScreen', 'appScreen'].forEach(screenId => element(screenId).classList.toggle('d-none', screenId !== id)); }
function showNotice(message, variant = 'success', { force = false } = {}) {
  if (variant === 'success' && !force) return;
  const notice = element('notice');
  notice.className = `alert alert-${variant}`;
  notice.textContent = message;
  notice.classList.remove('d-none');
  window.clearTimeout(showNotice.timeout);
  showNotice.timeout = window.setTimeout(() => notice.classList.add('d-none'), variant === 'danger' ? 7000 : 5000);
}
function setBusy(button, busy, label) { button.disabled = busy; button.textContent = label; }
