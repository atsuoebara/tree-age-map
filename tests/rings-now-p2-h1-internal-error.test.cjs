'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {classifyLog,safeCategories}=require('./rings-now-p2-h1-internal-error.cjs');
const {createBoundedDockerCommand}=require('./rings-now-p2-g3-bounded-docker-command.cjs');
test('only fixed SQLSTATE categories survive both log streams',()=>{
 assert.deepEqual(classifyLog('secret SQLSTATE 42P01 email@example.invalid','password SQLSTATE 42501'),['INSUFFICIENT_PRIVILEGE','UNDEFINED_TABLE']);
 assert.deepEqual(classifyLog('secret 42P01','SQLSTATE ABCDE'),['NO_MATCH']);
 assert.deepEqual(safeCategories(['UNDEFINED_TABLE','secret']),['UNAVAILABLE']);
});
test('fixed logs invocation returns categories only, including stderr',async()=>{
 const command=createBoundedDockerCommand({execFileImpl:(exe,args,opts,cb)=>{cb(null,'private SQLSTATE 42P01','private SQLSTATE 42501');return {};}});
 const result=await command({executable:'docker',argv:['container','logs','--tail','80','rn_p2_abcdefgh_gotrue'],timeoutMs:15000,environment:{},shell:false,attachStdin:false,captureLimitBytes:65536});
 assert.deepEqual(JSON.parse(result.stdout),['INSUFFICIENT_PRIVILEGE','UNDEFINED_TABLE']);
 assert.ok(!JSON.stringify(result).includes('private'));
});
