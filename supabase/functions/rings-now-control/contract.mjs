// Rings Now / prospective Supabase control endpoint.
// NOT deployed; fail-closed only. No FIT, analytics, identity, DB, storage or logging.
// HTTP metadata (IP, User-Agent, routing/logs) still needs independent host audit.
const PROTOCOL = 'rings-now-review-v1';
const BUILD = 'v1';
const MAX_BYTES = 128;
const ORIGIN = 'https://runnersrings.com';
const HEADERS = Object.freeze({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, no-cache, max-age=0, must-revalidate',
  'pragma': 'no-cache',
  'expires': '0',
  'x-content-type-options': 'nosniff',
});
const cors = origin => origin===ORIGIN ? {'access-control-allow-origin':ORIGIN,'vary':'Origin'} : {'vary':'Origin'};
const deny = (status=200,origin=null) => new Response(
  JSON.stringify({protocol: PROTOCOL, build: BUILD, enabled: false}),
  {status, headers: {...HEADERS,...cors(origin)}},
);
async function limitedBody(request) {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  } finally {
    try { reader.releaseLock(); } catch { /* no effect on response */ }
  }
  const bytes = new Uint8Array(total);
  let pos = 0;
  for (const part of chunks) { bytes.set(part, pos); pos += part.byteLength; }
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export async function handleRingsNowControl(request) {
  if (!(request instanceof Request)) throw new TypeError('Request expected');
  const origin=request.headers.get('origin');
  if(origin!==ORIGIN)return deny(403,origin);
  if(request.method==='OPTIONS'){
    if(request.headers.get('access-control-request-method')!=='POST'||
       request.headers.get('access-control-request-headers')?.trim().toLowerCase()!=='content-type')
      return deny(403,origin);
    return new Response(null,{status:204,headers:{...HEADERS,...cors(origin),
      'access-control-allow-methods':'POST','access-control-allow-headers':'content-type','access-control-max-age':'0'}});
  }
  if(request.method!=='POST')return deny(405,origin);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return deny(415,origin);
  try {
    const content = await limitedBody(request);
    if (content === null) return deny(400,origin);
    const payload = JSON.parse(content);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
        Object.keys(payload).length !== 2 ||
        payload.protocol !== PROTOCOL || payload.build !== BUILD) return deny(400,origin);
  } catch {
    return deny(400,origin);
  }
  // Deliberately NEVER enables FIT processing, even for a perfectly valid request.
  return deny(200,origin);
}
