'use strict';
// Concrete ephemeral service variables for an approved future isolated runner.
// No filesystem work on import. Never copy production credentials.
// Docker daemon can inspect container environment: isolation & teardown
// must be independently verified. This is NOT proof of correct boot/auth.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const assert=require('node:assert/strict');
const SERVICES=Object.freeze(['postgres','gotrue','postgrest']);
function createEphemeralP2Runtime(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rn-p2-'));
 assert.match(dir,/^\/tmp\/rn-p2-[a-zA-Z0-9_-]{6,64}$/);
 fs.chmodSync(dir,0o700);
 const pw=randomBytes(32).toString('hex');
 const jwt=randomBytes(48).toString('hex');
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
   GOTRUE_DB_DATABASE_URL:'postgres://postgres:'+pw+'@postgres:5432/rings_now_p2?sslmode=disable',
   GOTRUE_JWT_SECRET:jwt,GOTRUE_JWT_AUD:'authenticated',
   GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',
   GOTRUE_EXTERNAL_EMAIL_ENABLED:'false',
   GOTRUE_EXTERNAL_PHONE_ENABLED:'false',
   GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED:'false',
   GOTRUE_DISABLE_SIGNUP:'true'
  },
  postgrest:{
   PGRST_DB_URI:'postgres://postgres:'+pw+'@postgres:5432/rings_now_p2?sslmode=disable',
   PGRST_DB_SCHEMAS:'public',
   PGRST_DB_ANON_ROLE:'anon',
   PGRST_JWT_SECRET:jwt,
   PGRST_JWT_ROLE_CLAIM_KEY:'.role',
   PGRST_SERVER_HOST:'0.0.0.0',
   PGRST_SERVER_PORT:'3000'
  }
 };
 const paths={};
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
 }catch(e){fs.rmSync(dir,{recursive:true,force:true});throw e;}
 let disposed=false;
 return Object.freeze({
  envFiles:Object.freeze(paths),
  dispose(){
   if(disposed)return;
   fs.rmSync(dir,{recursive:true,force:true,maxRetries:1});
   disposed=true;
  }
 });
}
module.exports={createEphemeralP2Runtime};
