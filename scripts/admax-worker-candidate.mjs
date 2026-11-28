// Undeployed candidate. No real ad tag until written provider approval.
const HEADERS = {
  'content-type':'text/html; charset=utf-8',
  'cache-control':'private, no-store, max-age=0',
  'content-security-policy':"default-src 'none'; frame-ancestors https://runnersrings.com; base-uri 'none'; form-action 'none'",
  'referrer-policy':'no-referrer',
  'x-content-type-options':'nosniff'
};
const blank = '<!doctype html><meta charset="utf-8"><title></title>';
const mock = '<!doctype html><meta charset="utf-8"><title>Advertisement test</title><p>Local synthetic ad placeholder</p>';
export default {
  fetch(request) {
    const url = new URL(request.url);
    const allowed = request.method === 'GET' && url.hostname === 'ads.runnersrings.com' &&
      url.pathname === '/frame/sp01' && url.search === '' &&
      request.cf?.country === 'JP' &&
      request.headers.get('sec-fetch-dest') === 'iframe' &&
      request.headers.get('sec-fetch-site') === 'same-site';
    // Test placeholder only. Actual tag and CSP need separate approval.
    return new Response(allowed ? mock : blank,{headers:HEADERS});
  }
};
