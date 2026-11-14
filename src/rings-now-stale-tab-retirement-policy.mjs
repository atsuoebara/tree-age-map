// REVIEW-ONLY model for a future synthetic rollout / stale-tab retirement.
// No network, storage, FIT reading, production flag changes, or automatic permission.
// A cached old page cannot discover a server-side withdrawal without a fresh signal.
export function evaluateSyntheticTabRetirement({
 loadedBuild,
 expectedBuild,
 tabVisible=true,
 lifecycleRevoked=false,
 rollbackDeclared=false,
 freshSignalVerified=false,
}={}){
 const failures=[];
 if(typeof loadedBuild!=='string'||!loadedBuild)failures.push('missing_loaded_build');
 if(typeof expectedBuild!=='string'||!expectedBuild)failures.push('missing_expected_build');
 if(loadedBuild!==expectedBuild)failures.push('build_mismatch');
 if(tabVisible!==true)failures.push('tab_not_visible');
 if(lifecycleRevoked!==false)failures.push('lifecycle_revoked');
 if(rollbackDeclared===true)failures.push('rollback_declared');
 if(freshSignalVerified!==true)failures.push('fresh_signal_unverified');
 return {
  status:failures.length?'blocked':'requires_manual_review',
  failures,
  allowRealFit:false,
  allowProduction:false,
  canGuaranteeOldTabRevocation:false
 };
}
