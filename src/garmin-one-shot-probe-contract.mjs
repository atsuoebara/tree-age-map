/**
 * Test-only state machine for one-shot Garmin shape verification.
 * Not a database, not a production lease, never imported by live receiver.
 * Models atomic claim and completion/expiry semantics for contract tests.
 */
export const MILLIS=1;
export function makeFakeAtomicProbeStore({enabledAt,expiresAt,connectionVersion,ownerId}) {
  if(!Number.isSafeInteger(enabledAt)||!Number.isSafeInteger(expiresAt)||expiresAt<=enabledAt
     ||typeof connectionVersion!=='string'||!connectionVersion||typeof ownerId!=='string'||!ownerId)
    throw Error('invalid_probe_configuration');
  let state='eligible', result=null, claims=0;
  const matches=(owner,version)=>owner===ownerId&&version===connectionVersion;
  return {
    // Synchronous transaction model: a single fake row can be claimed once.
    // A real DB implementation MUST use one conditional UPDATE with DB clock.
    claim({owner,version,now}) {
      if(!Number.isSafeInteger(now)||!matches(owner,version)||now<enabledAt||now>=expiresAt||state!=='eligible')
        return false;
      state='claimed';claims++;return true;
    },
    finish({owner,version,now,counts}) {
      if(state!=='claimed'||!matches(owner,version)||!Number.isSafeInteger(now)||now>=expiresAt
        ||now<enabledAt||!counts||counts.ok!==true) return false;
      // Test-only projection: no activity/person or raw sensor values.
      result={sampleCount:counts.sampleCount,activityCount:counts.activityCount};
      state='finished';return true;
    },
    revoke(){state='revoked';result=null;},
    snapshot(){return {state,claims,result};}
  };
}
/**
 * Model independence between the existing import/ACK and optional probe.
 * Errors (including storage/lease failures) never influence the import response.
 * This is NOT connected to the Edge receiver.
 */
export async function modelOptionalProbe({existingImport,probe}) {
  const response=await existingImport();
  try {await probe();}catch { /* optional only; never log raw input */ }
  return response;
}
