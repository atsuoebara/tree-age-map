'use strict';
const CASES=['h1_signin_a','h1_signin_b','h2_anonymous','h2_owner_a','h2_foreign_a','h2_owner_b','h2_bad_signature','h2_expired_token','h2_no_rpc_grant','v03_get_owner_a','v03_get_owner_b','v03_get_foreign_a','v03_get_anonymous','v03_get_bad_signature','v03_get_expired_token','v03_get_no_rpc_grant'];
const PHASES=['PREPARE','POLICY','BUDGET','RECEIPT','WAIT','WAIT_CHECK','REFRESH','HANDOFF','SEED','TOKEN_CHECK','REQUEST','TRANSPORT','RESPONSE','SUMMARY'];
function safeH2Diagnostic(x){
 if(!PHASES.includes(x?.phase))return null;
 return {phase:x.phase,caseId:CASES.includes(x.caseId)?x.caseId:null,httpStatus:Number.isInteger(x.httpStatus)&&x.httpStatus>=100&&x.httpStatus<=599?x.httpStatus:null};
}
module.exports={safeH2Diagnostic};
