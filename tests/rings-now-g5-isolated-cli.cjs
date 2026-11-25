'use strict';
// Review-only entrypoint. Cannot start Docker even with forged manifest.
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {validateLiveManifest}=require('./rings-now-g5-real-docker-runner.cjs');
const manifest=require('./rings-now-g5-isolated-manifest.json');
function review(){
 assert.match(process.env.GITHUB_SHA||'',/^[a-f0-9]{40}$/);
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',timeout:5000}).trim(),process.env.GITHUB_SHA);
 assert.equal(manifest.productionAccess,false);
 assert.equal(manifest.explicitExecutionApproval,false);
 assert.equal(validateLiveManifest(manifest).pass,false);
 return {status:'BLOCKED_NOT_RUN',attempted:false,g5Verified:false};
}
if(require.main===module){
 assert.deepEqual(process.argv.slice(2),['--review-only']);
 console.log(JSON.stringify(review()));
 process.exitCode=1;
}
module.exports={review};
