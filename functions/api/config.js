// Die Supabase Anon-Key darf im Browser verwendet werden. Der eigentliche
// Datenschutz liegt in den Supabase Row-Level-Security-Regeln der Migration.
export async function onRequestGet({ env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: 'Supabase ist noch nicht konfiguriert.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }

  return new Response(JSON.stringify({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
