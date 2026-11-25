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
  const authUri=new URL(auth.GOTRUE_DB_DATABASE_URL);
  assert.equal(authUri.hostname,'postgres');
  assert.equal(authUri.port,'5432');
  assert.equal(authUri.pathname,'/rings_now_p2');
  assert.equal(authUri.searchParams.get('sslmode'),'disable');
  assert.equal(authUri.searchParams.get('options'),'-csearch_path=auth');
  assert.deepEqual([...authUri.searchParams.keys()],['sslmode','options']);
  assert.equal(new URL(rest.PGRST_DB_URI).searchParams.has('options'),false);
  assert.match(rest.PGRST_DB_URI,/^postgres:\/\/authenticator:[a-f0-9]{64}@postgres:5432\/rings_now_p2\?sslmode=disable$/);
  assert.ok(!rest.PGRST_DB_URI.includes(pg.POSTGRES_PASSWORD));
  assert.equal(fs.statSync(runtime.bootstrapSqlFile).mode&0o777,0o600);
  const authSql=fs.readFileSync(runtime.bootstrapSqlFile,'utf8');
  assert.match(authSql,/^BEGIN;\nCREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '[a-f0-9]{64}';\nGRANT anon TO authenticator;\nGRANT authenticated TO authenticator;\nCREATE SCHEMA p2_guard;/);
  assert.equal(rest.PGRST_DB_PRE_REQUEST,'p2_guard.strict_jwt_expiry');
  assert.equal(auth.PGRST_DB_PRE_REQUEST,undefined);
  assert.equal(pg.PGRST_DB_PRE_REQUEST,undefined);
  assert.ok(authSql.includes("expiry <= extract(epoch FROM clock_timestamp())"));
  assert.ok(authSql.includes("jsonb_typeof(claims -> 'exp') IS DISTINCT FROM 'number'"));
  assert.ok(authSql.includes("RAISE SQLSTATE 'PT401'"));
  assert.ok(authSql.includes('SECURITY INVOKER SET search_path'));
  assert.ok(authSql.includes('REVOKE ALL ON FUNCTION p2_guard.strict_jwt_expiry() FROM PUBLIC'));
  assert.ok(authSql.endsWith('COMMIT;\n'));
  assert.equal(auth.DB_NAMESPACE,'auth');
  assert.equal(pg.DB_NAMESPACE,undefined);
  assert.equal(rest.DB_NAMESPACE,undefined);
  assert.equal(auth.GOTRUE_EXTERNAL_EMAIL_ENABLED,'true');
  assert.equal(auth.GOTRUE_MAILER_AUTOCONFIRM,'true');
  assert.equal(auth.GOTRUE_EXTERNAL_PHONE_ENABLED,'false');
  assert.equal(auth.GOTRUE_DISABLE_SIGNUP,'false');
  assert.equal(runtime.h1EphemeralDir,require('node:path').dirname(ps.gotrue));
  for(const [who,identity] of Object.entries(runtime.h1Users)){
   assert.match(identity.email,new RegExp('^rn-p2-[a-f0-9]{24}-'+who+'@example\\.invalid$'));
   assert.match(identity.password,/^[a-f0-9]{64}$/);
  }
  assert.notEqual(runtime.h1Users.a.email,runtime.h1Users.b.email);
  const runtimeJson=JSON.stringify(runtime);
  for(const u of Object.values(runtime.h1Users)){
   assert.ok(!runtimeJson.includes(u.email));
   assert.ok(!runtimeJson.includes(u.password));
  }
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
  assert.notEqual(a.h1Users.a.email,b.h1Users.a.email);
  assert.notEqual(a.h1Users.a.password,b.h1Users.a.password);
 }finally{a.dispose();b.dispose();}
});

test('synthetic JWT uses run-specific HS256 secret, fixed subjects and 60-second expiry',()=>{
 const {createHmac}=require('node:crypto');
 const a=createEphemeralP2Runtime(),b=createEphemeralP2Runtime();
 const sub='00000000-0000-4000-8000-000000000001';
 try{
  const tok=a.issueSyntheticJwt({subject:sub,nowSeconds:1700000000});
  const parts=tok.split('.');
  assert.equal(parts.length,3);
  const header=JSON.parse(Buffer.from(parts[0],'base64url'));
  const claims=JSON.parse(Buffer.from(parts[1],'base64url'));
  assert.equal(header.alg,'HS256');assert.equal(header.typ,'JWT');
  assert.equal(claims.sub,sub);assert.equal(claims.role,'authenticated');
  assert.equal(claims.exp-claims.iat,60);
  const env=fs.readFileSync(a.envFiles.postgrest,'utf8');
  const secret=env.match(/^PGRST_JWT_SECRET=(.*)$/m)[1];
  assert.equal(parts[2],createHmac('sha256',secret).update(parts[0]+'.'+parts[1]).digest('base64url'));
  assert.notEqual(tok,b.issueSyntheticJwt({subject:sub,nowSeconds:1700000000}));
  assert.throws(()=>a.issueSyntheticJwt({subject:'00000000-0000-4000-8000-000000000003'}));
 }finally{a.dispose();b.dispose();}
});

test('private signed RPC request is prepared once with fresh JWT and deleted',()=>{
 const {createHmac}=require('node:crypto');
 const r=createEphemeralP2Runtime();
 let file;
 try{
  file=r.prepareHttpProbe({nowSeconds:1700000000});
  assert.match(file,/^\/tmp\/rn-p2-[a-zA-Z0-9_-]{6,64}\/http-probe\.req$/);
  assert.equal(fs.statSync(file).mode&0o777,0o600);
  const req=fs.readFileSync(file,'utf8');
  assert.ok(req.startsWith('POST /rpc/rings_now_snapshot_candidate_v01 HTTP/1.1\r\n'));
  assert.ok(req.includes('\r\nHost: postgrest:3000\r\n'));
  assert.ok(req.endsWith('\r\n\r\n{}'));
  const token=req.match(/Authorization: Bearer ([A-Za-z0-9_.-]+)/)[1];
  const parts=token.split('.');
  const claims=JSON.parse(Buffer.from(parts[1],'base64url'));
  assert.equal(claims.sub,'00000000-0000-4000-8000-000000000001');
  assert.equal(claims.exp,1700000060);
  const secret=fs.readFileSync(r.envFiles.postgrest,'utf8')
   .match(/^PGRST_JWT_SECRET=(.*)$/m)[1];
  assert.equal(parts[2],createHmac('sha256',secret)
   .update(parts[0]+'.'+parts[1]).digest('base64url'));
  assert.throws(()=>r.prepareHttpProbe({nowSeconds:1700000001}));
 }finally{r.dispose();}
 assert.equal(fs.existsSync(file),false);
 assert.throws(()=>r.prepareHttpProbe());
});
