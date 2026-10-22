import { logoBase64 } from './logo.ts';

const ORIGIN = 'https://runnersrings.com';
const COOKIE = '__Secure-rr-garmin-oauth';
const PATH = '/functions/v1/garmin-oauth';
const TOKEN = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';
const API = 'https://apis.garmin.com/wellness-api/rest/user';
const encoder = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const unb64 = text => Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));

// No provider tokens, authorization codes, or request URLs are logged or returned to the browser.
export function createHandler(env, request = fetch) {
  const respond = (text, status = 200, extra = {}) => new Response(text, { status, headers: {
    'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', ...extra,
  }});
  const cookie = value => `${COOKIE}=${value}; Path=${PATH}; HttpOnly; Secure; SameSite=Lax; Max-Age=${value ? 600 : 0}`;
  const config = () => {
    const result = Object.fromEntries(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GARMIN_CLIENT_ID', 'GARMIN_CLIENT_SECRET', 'GARMIN_TOKEN_KEY'].map(k => [k, env(k)]));
    if (Object.values(result).some(x => !x) || !/^[0-9a-f]{64}$/i.test(result.GARMIN_TOKEN_KEY)) throw new Error('configuration');
    return result;
  };
  async function key(c) {
    return crypto.subtle.importKey('raw', Uint8Array.from(c.GARMIN_TOKEN_KEY.match(/../g), x => parseInt(x, 16)), 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  async function seal(c, value, purpose) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(purpose) }, await key(c), encoder.encode(JSON.stringify(value)));
    return `${b64(iv)}.${b64(new Uint8Array(ciphertext))}`;
  }
  async function open(c, value, purpose) {
    const parts = value.split('.');
    if (parts.length !== 2) throw new Error('invalid envelope');
    const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(parts[0]), additionalData: encoder.encode(purpose) }, await key(c), unb64(parts[1]));
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  async function json(url, init) {
    const res = await request(url, { ...init, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error('upstream');
    return res.status === 204 ? null : res.json();
  }
  const adminHeaders = c => ({ apikey: c.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${c.SUPABASE_SERVICE_ROLE_KEY}` });
  async function user(c, token) {
    if (!token) throw new Error('authentication');
    return json(`${c.SUPABASE_URL}/auth/v1/user`, { headers: { ...adminHeaders(c), Authorization: `Bearer ${token}` } });
  }
  return async req => {
    const url = new URL(req.url);
    const route = url.pathname.slice(url.pathname.indexOf('/garmin-oauth') + '/garmin-oauth'.length);
    if (route === '/logo.png' && req.method === 'GET') return new Response(unb64(logoBase64), { headers: {
      'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff',
    }});
    if ((route === '' || route === '/') && req.method === 'GET') return respond('Runner\'s Rings Garmin OAuth endpoint. Callback: /callback. Registration credentials must be configured before connecting.');
    if (!['/start', '/callback', '/disconnect'].includes(route)) return respond('Not found', 404);
    if (req.method !== (route === '/callback' ? 'GET' : 'POST')) return respond('Method not allowed', 405);
    if (route !== '/callback' && req.headers.get('Origin') !== ORIGIN) return respond('Invalid origin', 403);
    // Check malformed callbacks even before credentials have been issued.
    if (route === '/callback' && (!url.searchParams.get('state') || (!url.searchParams.get('code') && !url.searchParams.has('error')))) return respond('Invalid OAuth callback. Start the connection from Runner\'s Rings.', 400);
    let c;
    try { c = config(); } catch { return respond('Garmin connection is not enabled yet. App registration credentials and the encryption key must be configured.', 503); }
    const callback = `${c.SUPABASE_URL}${PATH}/callback`;
    const db = `${c.SUPABASE_URL}/rest/v1/garmin_api_connections`;
    const clear = { 'Set-Cookie': cookie('') };
    try {
      if (route === '/start' || route === '/disconnect') {
        // Submit this form by top-level POST so the HttpOnly cookie works without third-party cookies.
        // Never put the Supabase session JWT in a query string.
        const form = await req.formData();
        let account;
        try { account = await user(c, String(form.get('access_token') || '')); } catch { return respond('Sign in to Runner\'s Rings first.', 401); }
        if (!account.id) return respond('Sign in to Runner\'s Rings first.', 401);
        if (route === '/disconnect') {
          const rows = await json(`${db}?user_id=eq.${encodeURIComponent(account.id)}&select=tokens_ciphertext`, { headers: adminHeaders(c) });
          if (rows.length) {
            const tokens = await open(c, rows[0].tokens_ciphertext, `tokens:${account.id}`);
            let access = tokens.access_token;
            if (tokens.expires_at <= Date.now() + 600000) {
              const refreshed = await json(TOKEN, { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', client_id: c.GARMIN_CLIENT_ID, client_secret: c.GARMIN_CLIENT_SECRET, refresh_token: tokens.refresh_token }) });
              if (!refreshed.access_token || !refreshed.refresh_token || !Number.isFinite(refreshed.expires_in)) throw new Error('tokens');
              access = refreshed.access_token;
              // Persist rotated credentials before deletion so an upstream failure can be retried.
              const rotated = await seal(c, { ...refreshed, expires_at: Date.now() + refreshed.expires_in * 1000 }, `tokens:${account.id}`);
              await json(`${db}?user_id=eq.${encodeURIComponent(account.id)}`, { method: 'PATCH', headers: { ...adminHeaders(c), 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ tokens_ciphertext: rotated }) });
            }
            const revoked = await request(`${API}/registration`, { method: 'DELETE', headers: { Authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(15000) });
            if (!revoked.ok && revoked.status !== 404 && revoked.status !== 410) throw new Error('revoke');
            await json(`${db}?user_id=eq.${encodeURIComponent(account.id)}`, { method: 'DELETE', headers: { ...adminHeaders(c), Prefer: 'return=representation' } });
          }
          return respond('Garmin connection removed. Contact Runner\'s Rings to request deletion of previously imported runs.', 200, clear);
        }
        const state = b64(crypto.getRandomValues(new Uint8Array(32)));
        const verifier = b64(crypto.getRandomValues(new Uint8Array(32)));
        const challenge = b64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))));
        const envelope = await seal(c, { user: account.id, state, verifier, exp: Date.now() + 600000 }, 'oauth');
        const auth = new URL('https://connect.garmin.com/oauth2Confirm');
        auth.search = new URLSearchParams({ response_type: 'code', client_id: c.GARMIN_CLIENT_ID, redirect_uri: callback, state, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
        return respond('', 303, { Location: auth.href, 'Set-Cookie': cookie(envelope) });
      }
      const value = req.headers.get('Cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
      if (!value) return respond('Missing OAuth session. Start the connection again.', 400, clear);
      let session;
      try { session = await open(c, value, 'oauth'); } catch { return respond('Invalid OAuth session.', 400, clear); }
      if (session.exp < Date.now() || session.state !== url.searchParams.get('state')) return respond('Expired or invalid OAuth state.', 400, clear);
      if (url.searchParams.has('error')) return respond('Garmin authorization was declined. No connection was saved.', 400, clear);
      const tokens = await json(TOKEN, { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', client_id: c.GARMIN_CLIENT_ID, client_secret: c.GARMIN_CLIENT_SECRET, redirect_uri: callback, code: url.searchParams.get('code'), code_verifier: session.verifier }) });
      if (!tokens.access_token || !tokens.refresh_token || !Number.isFinite(tokens.expires_in)) throw new Error('tokens');
      const headers = { Authorization: `Bearer ${tokens.access_token}` };
      const identity = await json(`${API}/id`, { headers });
      const permissions = await json(`${API}/permissions`, { headers });
      if (!identity.userId) throw new Error('identity');
      const encrypted = await seal(c, { ...tokens, expires_at: Date.now() + tokens.expires_in * 1000 }, `tokens:${session.user}`);
      await json(`${db}?on_conflict=user_id`, { method: 'POST', headers: { ...adminHeaders(c), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ user_id: session.user, garmin_user_id: identity.userId, tokens_ciphertext: encrypted, permissions, updated_at: new Date().toISOString() }) });
      return respond('', 303, { ...clear, Location: `${ORIGIN}/?garmin=connected` });
    } catch {
      return respond('Garmin connection could not be completed. Try again or contact Runner\'s Rings support.', 502, clear);
    }
  };
}

if (typeof Deno !== 'undefined') Deno.serve(createHandler(name => Deno.env.get(name)));
