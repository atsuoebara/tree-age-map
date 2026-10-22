import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const elements = Object.fromEntries(['garminApiConnectButton','garminApiDisconnectButton','garminApiMessage'].map(id=>[id,{}]));
elements.garminShortcutButton = {};
elements.accountPanel = {open:false};
let scrolled = false;
elements.garminApiSection = {scrollIntoView(){scrolled=true;}};
let posted, removed=false, connected=false, authChange, requests=0;
const user = { access_token:'test-user-token' };
const client = { auth:{getSession:async()=>({data:{session:user}}),onAuthStateChange:fn=>{authChange=fn;}} };
const context = {window:{addEventListener(){},location:{href:'https://runnersrings.com/'},history:{replaceState(){}}},URL,document:{
  getElementById:id=>elements[id],body:{appendChild(){}},createElement:tag=>tag==='form'?{appendChild(input){this.input=input},submit(){posted=this},remove(){removed=true}}:{},
},localStorage:{getItem:()=> 'ja'},navigator:{language:'ja'},URLSearchParams,AbortSignal,setTimeout,confirm:()=>true,
fetch:async(url,init)=>{requests++;assert.ok(url.endsWith('/garmin-oauth/status'));assert.equal(init.body.get('access_token'),user.access_token);return {ok:true,json:async()=>({connected})};}};
vm.runInNewContext(fs.readFileSync(new URL('../garmin-connect.js',import.meta.url),'utf8'),context);
context.window.initGarminConnection({client,url:'https://example.supabase.co'});
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
await tick();
assert.equal(elements.garminApiConnectButton.hidden,false);
assert.equal(elements.garminApiDisconnectButton.hidden,true);
assert.equal(elements.garminShortcutButton.textContent,'Garminに接続');
elements.garminShortcutButton.onclick();
assert.equal(elements.accountPanel.open,true);
assert.equal(scrolled,true);
await elements.garminApiConnectButton.onclick();
assert.equal(posted.method,'POST'); assert.ok(posted.action.endsWith('/start'));
assert.equal(posted.input.name,'access_token'); assert.equal(posted.input.value,user.access_token); assert.ok(removed);
// New page lifecycle with a connection: show disconnect and report automatic GPS import.
connected=true;
context.window.initGarminConnection({client,url:'https://example.supabase.co'});
await tick();
assert.equal(elements.garminApiDisconnectButton.hidden,false);
assert.equal(elements.garminShortcutButton.textContent,'✓ Garmin接続済み');
assert.match(elements.garminApiMessage.textContent,/GPS付きのランを自動で取り込み/);
await elements.garminApiDisconnectButton.onclick();
assert.ok(posted.action.endsWith('/disconnect'));
assert.ok(!posted.action.includes(user.access_token));
console.log('Garmin controls: authenticated status, connect/disconnect POST, hidden JWT body, connected state and automatic GPS-import message passed.');
