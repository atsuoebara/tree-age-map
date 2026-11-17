'use strict';
// G3 resource lifecycle evidence consistency, OFFLINE ONLY.
// A caller-provided inventory is NOT evidence of real container/process absence.
// No Docker, sockets, processes, filesystem or Actions invoked.
const SERVICES=Object.freeze(['postgres','gotrue','postgrest']);
const TYPES=new Set(['container','network','process','volume']);
const HEX=/^[0-9a-f]{40}$/;
function inspectG3ResourceEvidence(record) {
 const failures=[],fail=x=>failures.push(x);
 const done=(status)=>Object.freeze({status,issues:Object.freeze(failures),
   actualResourcesVerified:false,g3Verified:false,p2ExecutionAuthorized:false});
 if(!record||typeof record!=='object'||Array.isArray(record)) {
   fail('invalid_record');return done('BLOCKED');
 }
 if(record.kind!=='SYNTHETIC_RESOURCE_INVENTORY'||record.realResourcesObserved!==false||
    record.source!=='INJECTED_TEST_INVENTORY'||record.executionApproval!==false)
   fail('not_synthetic_only');
 if(!HEX.test(record.checkoutCommit||''))fail('missing_checkout');
 if(record.productionAccess!==false||record.billingVerified!==false||record.g1Verified!==false)
   fail('gate_promotion');
 if(record.cleanupAttempted!==true||record.cleanupStatus!=='CLEAN'||
    record.verificationAttempted!==true||record.verificationStatus!=='EMPTY')
   fail('cleanup_or_verification_missing');
 if(!Array.isArray(record.before)||!Array.isArray(record.created)||!Array.isArray(record.after)||
    !Array.isArray(record.expectedServices)) {
   fail('invalid_inventory');return done('BLOCKED');
 }
 if(record.expectedServices.length!==3||
    record.expectedServices.join(',')!==SERVICES.join(','))fail('service_set_mismatch');
 const validate=(rows,phase)=>{
   const seen=new Set();
   for(const row of rows){
     if(!row||typeof row!=='object'||Array.isArray(row)||
        typeof row.id!=='string'||!row.id||!/^[a-z0-9][a-z0-9_-]{0,100}$/.test(row.id)||
        !TYPES.has(row.type)||typeof row.owner!=='string'||row.owner!==record.runId) {
       fail(phase+'_invalid_resource');continue;
     }
     const key=row.type+':'+row.id;
     if(seen.has(key))fail(phase+'_duplicate_resource');
     seen.add(key);
   }
   return seen;
 };
 if(typeof record.runId!=='string'||!/^[a-z0-9][a-z0-9_-]{3,100}$/.test(record.runId))
   fail('invalid_run_id');
 // Before/after inventories may contain zero run-owned objects. Reject claims
 // that pre-existing or foreign resources were ours to delete.
 const before=validate(record.before,'before');
 const created=validate(record.created,'created');
 const after=validate(record.after,'after');
 if(before.size!==0)fail('preexisting_run_owned_resources');
 if(created.size===0)fail('no_created_resources');
 for(const k of created)if(before.has(k))fail('resource_collision');
 for(const k of after)if(created.has(k))fail('resource_leftover');
 if(after.size!==0)fail('after_inventory_not_empty');
 const serviceNames=record.created.filter(x=>x?.type==='container')
   .map(x=>x?.service);
 if(serviceNames.length!==3||[...serviceNames].sort().join(',')!==[...SERVICES].sort().join(','))
   fail('missing_or_duplicate_service_container');
 return done(failures.length?'BLOCKED':'SYNTHETIC_INVENTORY_CONSISTENT_NOT_REAL_PROOF');
}
module.exports={inspectG3ResourceEvidence};
