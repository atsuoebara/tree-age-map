'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createEphemeralP2Runtime}=require('./rings-now-p2-ephemeral-service-runtime.cjs');
test('files contain three isolated service configs, shared JWT and random DB secret, then disappear',()=>{
 const runtime=createEphemeralP2Runtime();
 const ps=runtime.envFiles;
 try{
  assert.deepEqual(Object.keys(ps).sort(),['gotrue','postgres','postgrest']);
  for(const name of Object.keys(ps)){
   assert.match(ps[name],/^\/tmp\/rn-p2-[a-zA-Z0-9_-]{6,64}\/(postgres|gotrue|postgrest)\.env$/);
   assert.equal(fs.statSync(ps[name]).mode&0o777,0o600);
  }
  const parse=file=>Object.fromEntries(fs.readFileSync(file,'utf8').trim().split('\n')
   .map(line=>{const at=line.indexOf('=');return [line.slice(0,at),line.slice(at+1)];}));
  const pg=parse(ps.postgres),auth=parse(ps.gotrue),rest=parse(ps.postgrest);
  assert.match(pg.POSTGRES_PASSWORD,/^[0-9a-f]{64}$/);
  assert.match(auth.GOTRUE_JWT_SECRET,/^[0-9a-f]{96}$/);
  assert.equal(auth.GOTRUE_JWT_SECRET,rest.PGRST_JWT_SECRET);
  assert.ok(auth.GOTRUE_DB_DATABASE_URL.includes(pg.POSTGRES_PASSWORD));
  assert.match(rest.PGRST_DB_URI,/^postgres:\/\/authenticator:[a-f0-9]{64}@postgres:5432\/rings_now_p2\?sslmode=disable$/);
  assert.ok(!rest.PGRST_DB_URI.includes(pg.POSTGRES_PASSWORD));
  assert.equal(fs.statSync(runtime.bootstrapSqlFile).mode&0o777,0o600);
  const authSql=fs.readFileSync(runtime.bootstrapSqlFile,'utf8');
  assert.match(authSql,/^BEGIN;\nCREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '[a-f0-9]{64}';\nGRANT anon TO authenticator;\nGRANT authenticated TO authenticator;\nCOMMIT;\n$/);
  assert.equal(auth.GOTRUE_EXTERNAL_EMAIL_ENABLED,'false');
  assert.equal(auth.GOTRUE_EXTERNAL_PHONE_ENABLED,'false');
  assert.equal(auth.GOTRUE_DISABLE_SIGNUP,'true');
  assert.equal(pg.PGDATA,'/var/lib/postgresql/data/pgdata');
 }finally{
  runtime.dispose();runtime.dispose();
 }
 for(const file of [...Object.values(ps),runtime.bootstrapSqlFile])assert.equal(fs.existsSync(file),false);
});
test('separate runtime creations produce different credentials',()=>{
 const a=createEphemeralP2Runtime(),b=createEphemeralP2Runtime();
 try{
  assert.notEqual(a.envFiles.postgres,b.envFiles.postgres);
  const pa=fs.readFileSync(a.envFiles.postgres,'utf8');
  const pb=fs.readFileSync(b.envFiles.postgres,'utf8');
  assert.notEqual(pa,pb);
 }finally{a.dispose();b.dispose();}
});
