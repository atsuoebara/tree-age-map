'use strict';
// Concrete ephemeral service variables for an approved future isolated runner.
// No filesystem work on import. Never copy production credentials.
// Docker daemon can inspect container environment: isolation & teardown
// must be independently verified. This is NOT proof of correct boot/auth.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {randomBytes,createHmac}=require('node:crypto');
const assert=require('node:assert/strict');
const {buildProbeRequest}=require('./rings-now-p2-docker-internal-http.cjs');
const SERVICES=Object.freeze(['postgres','gotrue','postgrest']);
function createEphemeralP2Runtime(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rn-p2-'));
 assert.match(dir,/^\/tmp\/rn-p2-[a-zA-Z0-9_-]{6,64}$/);
 fs.chmodSync(dir,0o700);
 const pw=randomBytes(32).toString('hex');
 const jwt=randomBytes(48).toString('hex');
 const authPw=randomBytes(32).toString('hex');
 const h1SuffixA=randomBytes(12).toString('hex');
 const h1SuffixB=randomBytes(12).toString('hex');
 const h1Users=Object.freeze({
  a:Object.freeze({email:'rn-p2-'+h1SuffixA+'-a@example.invalid',
   password:randomBytes(32).toString('hex')}),
  b:Object.freeze({email:'rn-p2-'+h1SuffixB+'-b@example.invalid',
   password:randomBytes(32).toString('hex')})
 });
 const env={
  postgres:{
   POSTGRES_USER:'postgres',POSTGRES_DB:'rings_now_p2',
   POSTGRES_PASSWORD:pw,PGDATA:'/var/lib/postgresql/data/pgdata'
  },
  gotrue:{
   API_EXTERNAL_URL:'http://gotrue:9999',
   GOTRUE_SITE_URL:'http://localhost',
   GOTRUE_API_HOST:'0.0.0.0',GOTRUE_API_PORT:'9999',
   GOTRUE_DB_DRIVER:'postgres',
   // Explicit GoTrue namespace, confined to the disposable auth service.
   DB_NAMESPACE:'auth',
   // Namespace selects migration schema, but unqualified runtime queries
   // also need the auth search path (upstream supabase/auth issue #1265).
   // Connection-local only: do not alter the postgres role/database defaults.
   GOTRUE_DB_DATABASE_URL:'postgres://postgres:'+pw+'@postgres:5432/rings_now_p2?sslmode=disable&options=-csearch_path%3Dauth',
   // Five minutes, only for the disposable per-run GoTrue container.
   // Never shorten JWT lifetime in production or claim expiration proof.
   GOTRUE_JWT_SECRET:jwt,GOTRUE_JWT_AUD:'authenticated',
   GOTRUE_JWT_EXP:'300',
   GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',
   // These settings exist ONLY inside the freshly created --internal
   // disposable Docker network. Confirmation requires no SMTP service.
   GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',
   GOTRUE_MAILER_AUTOCONFIRM:'true',
   GOTRUE_EXTERNAL_PHONE_ENABLED:'false',
   GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED:'false',
   GOTRUE_DISABLE_SIGNUP:'false'
  },
  postgrest:{
   PGRST_DB_URI:'postgres://authenticator:'+authPw+'@postgres:5432/rings_now_p2?sslmode=disable',
   PGRST_DB_SCHEMAS:'public',
   PGRST_DB_ANON_ROLE:'anon',
   PGRST_DB_PRE_REQUEST:'p2_guard.strict_jwt_expiry',
   PGRST_JWT_SECRET:jwt,
   PGRST_JWT_ROLE_CLAIM_KEY:'.role',
   PGRST_SERVER_HOST:'0.0.0.0',
   PGRST_SERVER_PORT:'3000'
  }
 };
 const paths={};
 const bootstrapSqlFile=path.join(dir,'authenticator.sql');
 try{
  for(const name of SERVICES){
   const filename=path.join(dir,name+'.env');
   const content=Object.entries(env[name]).map(([key,value])=>{
    assert.match(key,/^[A-Z][A-Z0-9_]+$/);
    assert.equal(typeof value,'string');
    assert.ok(value&&!/[\r\n\0]/.test(value));
    return key+'='+value;
   }).join('\n')+'\n';
   const fd=fs.openSync(filename,'wx',0o600);
   try{fs.writeFileSync(fd,content,{encoding:'utf8'});}
   finally{fs.closeSync(fd);}
   paths[name]=filename;
  }
  // Hex-only per-run password; never embed production data or arbitrary SQL.
  const sql='BEGIN;\n'+
   "CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '"+authPw+"';\n"+
   'GRANT anon TO authenticator;\n'+
   'GRANT authenticated TO authenticator;\n'+
   "CREATE SCHEMA p2_guard;\nREVOKE ALL ON SCHEMA p2_guard FROM PUBLIC;\nCREATE FUNCTION p2_guard.strict_jwt_expiry() RETURNS void\nLANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = ''\nAS $guard$\nDECLARE claims jsonb; expiry numeric;\nBEGIN\n  claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;\n  IF current_user = 'anon' AND (claims IS NULL OR claims = '{}'::jsonb OR claims = '{\"role\":\"anon\"}'::jsonb) THEN\n    RETURN;\n  END IF;\n  IF jsonb_typeof(claims -> 'exp') IS DISTINCT FROM 'number' THEN\n    RAISE SQLSTATE 'PT401' USING MESSAGE = 'Invalid or expired token';\n  END IF;\n  expiry := (claims ->> 'exp')::numeric;\n  IF expiry <= extract(epoch FROM clock_timestamp()) THEN\n    RAISE SQLSTATE 'PT401' USING MESSAGE = 'Invalid or expired token';\n  END IF;\nEND;\n$guard$;\nREVOKE ALL ON FUNCTION p2_guard.strict_jwt_expiry() FROM PUBLIC;\nGRANT USAGE ON SCHEMA p2_guard TO anon, authenticated;\nGRANT EXECUTE ON FUNCTION p2_guard.strict_jwt_expiry() TO anon, authenticated;\n"+'COMMIT;\n';
  const fd=fs.openSync(bootstrapSqlFile,'wx',0o600);
  try{fs.writeFileSync(fd,sql,{encoding:'utf8'});}
  finally{fs.closeSync(fd);}
 }catch(e){fs.rmSync(dir,{recursive:true,force:true});throw e;}
 let disposed=false,requestCreated=false;
 const runtime={
  envFiles:Object.freeze(paths),
  bootstrapSqlFile,
  // Synthetic-only JWT accepted by the isolated PostgREST's random
  // GOTRUE_JWT_SECRET/PGRST_JWT_SECRET; NOT a GoTrue-issued real login.
  issueSyntheticJwt({subject,nowSeconds=Math.floor(Date.now()/1000)}={}){
   const allowed=[
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002'
   ];
   assert.ok(allowed.includes(subject),'synthetic subject only');
   assert.ok(Number.isSafeInteger(nowSeconds)&&nowSeconds>0);
   const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
   const input=encode({alg:'HS256',typ:'JWT'})+'.'+encode({
    sub:subject,role:'authenticated',aud:'authenticated',
    iat:nowSeconds,exp:nowSeconds+60
   });
   return input+'.'+createHmac('sha256',jwt).update(input).digest('base64url');
  },
  // Synthetic H2-only tokens: signed using the isolated random per-run
  // secret, NOT actually issued by GoTrue. Do not use as G4 proof of a
  // GoTrue-issued token becoming expired over elapsed real time.
  issueH2SignedTestToken({subject,role,nowSeconds,expired=false}={}){
   assert.equal(disposed,false);
   assert.match(subject||'',/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
   assert.ok(['authenticated','p2_h2_no_rpc'].includes(role),'approved isolated JWT roles only');
   assert.equal(typeof expired,'boolean');
   assert.ok(Number.isSafeInteger(nowSeconds)&&nowSeconds>120);
   assert.equal(expired,role==='authenticated','only an authenticated expired token or valid denied role');
   const claims={
    sub:subject,role,aud:'authenticated',
    iat:expired?nowSeconds-120:nowSeconds-1,
    exp:expired?nowSeconds-60:nowSeconds+3600
   };
   const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
   const input=encode({alg:'HS256',typ:'JWT'})+'.'+encode(claims);
   return input+'.'+createHmac('sha256',jwt).update(input).digest('base64url');
  },
  prepareHttpProbe({nowSeconds=Math.floor(Date.now()/1000)}={}){
   assert.equal(disposed,false);
   assert.equal(requestCreated,false,'a probe request must be prepared once');
   const token=this.issueSyntheticJwt({
    subject:'00000000-0000-4000-8000-000000000001',nowSeconds
   });
   const request=buildProbeRequest(token);
   const filename=path.join(dir,'http-probe.req');
   const fd=fs.openSync(filename,'wx',0o600);
   try{fs.writeFileSync(fd,request,{encoding:'utf8'});}
   finally{fs.closeSync(fd);}
   requestCreated=true;
   return filename;
  },
  dispose(){
   if(disposed)return;
   fs.rmSync(dir,{recursive:true,force:true,maxRetries:1});
   disposed=true;
  }
 };
 // Keep private H1 credentials out of JSON.stringify(runtime) and generic
 // enumerable object logging, while retaining in-memory runner access.
 Object.defineProperties(runtime,{
  h1Users:{value:h1Users,enumerable:false},
  h1EphemeralDir:{value:dir,enumerable:false}
 });
 return Object.freeze(runtime);
}
module.exports={createEphemeralP2Runtime};
