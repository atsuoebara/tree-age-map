'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createBoundedDockerCommand}=require('./rings-now-p2-g3-bounded-docker-command.cjs');
const spec={executable:'docker',argv:['network','ls','--filter','label=com.runnersrings.p2.run=rn_p2_abcdefgh'],
 timeoutMs:15000,environment:{},shell:false,attachStdin:false,captureLimitBytes:65536};
test('bounded adapter invokes docker without shell, secrets or inherited env',async()=>{
 const observed=[];
 const execFileImpl=(bin,args,options,cb)=>{
  observed.push({bin,args,options});
  cb(null,'','');
 };
 const run=createBoundedDockerCommand({execFileImpl});
 const out=await run(spec);assert.equal(out.exitCode,0);
 assert.equal(observed.length,1);
 assert.equal(observed[0].bin,'docker');
 assert.deepEqual(observed[0].options.env,{});
 assert.equal(observed[0].options.timeout,15000);
 assert.equal(observed[0].options.killSignal,'SIGKILL');
 assert.equal(observed[0].options.shell,false);
});
test('timeout, error and nonzero exit are rejected',async()=>{
 const run=createBoundedDockerCommand({execFileImpl:(b,a,o,cb)=>cb(Object.assign(Error('timed out'),{code:'ETIMEDOUT'}),'','')});
 await assert.rejects(()=>run(spec));
});
test('no subprocess is run for fabricated runner settings',async()=>{
 let calls=0;
 const run=createBoundedDockerCommand({execFileImpl:(b,a,o,cb)=>{calls++;cb(null,'','');}});
 for(const extra of [{executable:'bash'},{shell:true},{environment:{SECRET:'x'}},
 {timeoutMs:600000},{captureLimitBytes:1024},{argv:['network','ls','x'.repeat(520)]}]){
  await assert.rejects(()=>run({...spec,...extra}));
 }
 assert.equal(calls,0);
});
test('oversized output is not accepted',async()=>{
 const run=createBoundedDockerCommand({execFileImpl:(b,a,o,cb)=>cb(null,'x'.repeat(65537),'')});
 await assert.rejects(()=>run(spec));
});

test('stdin accepts only fixed owned transfer shape and sends bytes privately',async()=>{
 const bytes=Buffer.from('fixture');let sent;
 const run=createBoundedDockerCommand({execFileImpl:(bin,args,opts,cb)=>({stdin:{on(){},end(x){sent=x;cb(null,'','');}}})});
 const transfer={...spec,attachStdin:true,stdinBytes:bytes,argv:['container','exec','-i','rn_p2_abcdefgh_postgres','/bin/bash','-c',"umask 077; cat > \"$1\"",'rn-p2-transfer','/tmp/rn-p2/authenticator.sql']};
 await run(transfer);assert.deepEqual(sent,bytes);
 await assert.rejects(()=>run({...transfer,argv:[...transfer.argv.slice(0,-1),'/etc/passwd']}));
 await assert.rejects(()=>run({...transfer,stdinBytes:Buffer.alloc(65537)}));
});
