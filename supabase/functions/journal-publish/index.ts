// Deploy with JWT verification enabled. Configure GITHUB_JOURNAL_TOKEN as an Edge Function secret.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
Deno.serve(async (req) => {
  const headers = { 'Access-Control-Allow-Origin': 'https://runnersrings.com', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response('', { headers });
  if (req.method !== 'POST' || req.headers.get('origin') !== 'https://runnersrings.com') return new Response('Forbidden', { status: 403, headers });
  try {
    const auth = req.headers.get('authorization') || '';
    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_ANON_KEY')!;
    const client = createClient(url, key, { global: { headers: { Authorization: auth } } });
    const { data, error } = await client.auth.getUser();
    if (error || data.user?.id !== '386da875-298e-46b7-927d-0e02d02c409a') return new Response('Unauthorized', { status: 403, headers });
    const token = Deno.env.get('GITHUB_JOURNAL_TOKEN');
    if (!token) throw new Error('Missing server-side GitHub token');
    const result = await fetch('https://api.github.com/repos/atsuoebara/tree-age-map/dispatches', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'journal-content-changed' })
    });
    if (!result.ok) throw new Error(`GitHub dispatch HTTP ${result.status}`);
    return new Response(JSON.stringify({ queued: true }), { headers });
  } catch (error) { console.error(error); return new Response(JSON.stringify({ error: 'Could not queue generation' }), { status: 502, headers }); }
});
