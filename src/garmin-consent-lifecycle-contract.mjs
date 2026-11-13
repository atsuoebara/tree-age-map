// Isolated, pure transition model for consent-safe Garmin lifecycle.
// No DB writes, OAuth calls or production imports. Provider unknown => fail closed.
export const States=Object.freeze({
  CONNECTED:'connected',
  DISCONNECT_REQUESTED:'disconnect_requested',
  REVOKE_INFLIGHT:'revoke_inflight',
  REVOKE_UNKNOWN:'revoke_unknown',
  DISCONNECTED:'disconnected',
  REAUTH_PENDING:'reauth_pending',
});
export function initialConsent(owner,generation) {
  if(!owner||!generation) throw Error('owner_generation_required');
  return Object.freeze({owner,generation,state:States.CONNECTED,pendingGeneration:null,canImport:true});
}
export function transitionConsent(record,event){
  if(!record||!event||event.owner!==record.owner) return {ok:false,reason:'not_owner',record};
  const deny=reason=>({ok:false,reason,record});
  const accept=changes=>({ok:true,record:Object.freeze({...record,...changes})});
  // A new authenticated grant is never made active while remote revocation is in flight
  // or has an unknown outcome.
  if(event.type==='reauthorize') {
    if(!event.generation||event.generation===record.generation) return deny('invalid_generation');
    if(record.state===States.REVOKE_INFLIGHT||record.state===States.REVOKE_UNKNOWN||
       record.state===States.DISCONNECT_REQUESTED||record.state===States.REAUTH_PENDING)
      return accept({state:States.REAUTH_PENDING,canImport:false,pendingGeneration:event.generation});
    if(record.state===States.CONNECTED||record.state===States.DISCONNECTED)
      return accept({state:States.CONNECTED,generation:event.generation,canImport:true,pendingGeneration:null});
    return deny('unknown_state');
  }
  // Every remote result is fenced against the generation that initiated deletion.
  if(event.generation!==record.generation) return deny('stale_generation');
  if(event.type==='disconnect') {
    if(record.state!==States.CONNECTED) return deny('already_disconnecting');
    return accept({state:States.DISCONNECT_REQUESTED,canImport:false});
  }
  if(event.type==='begin_revoke') {
    if(record.state!==States.DISCONNECT_REQUESTED) return deny('revoke_not_requested');
    return accept({state:States.REVOKE_INFLIGHT,canImport:false});
  }
  if(event.type==='revoke_timeout') {
    if(record.state!==States.REVOKE_INFLIGHT) return deny('not_inflight');
    return accept({state:States.REVOKE_UNKNOWN,canImport:false});
  }
  if(event.type==='revoke_confirmed') {
    if(![States.REVOKE_INFLIGHT,States.REVOKE_UNKNOWN,States.REAUTH_PENDING].includes(record.state))
      return deny('not_revoking');
    // Do not activate pending consent automatically; the old provider DELETE might
    // have invalidated it. Clear the pending generation and require a fresh safe
    // authentication after confirmation.
    return accept({state:States.DISCONNECTED,canImport:false,pendingGeneration:null});
  }
  if(event.type==='retry_revoke') {
    if(record.state!==States.REVOKE_UNKNOWN&&record.state!==States.REAUTH_PENDING)
      return deny('retry_not_due');
    return accept({state:States.REVOKE_INFLIGHT,canImport:false});
  }
  return deny('unknown_event');
}
