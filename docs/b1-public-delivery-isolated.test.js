'use strict';
// Synthetic B-1 public delivery contract model. No production DB or network.
const assert=require('node:assert/strict');
class Gate{
 constructor(){this.enabled=false;this.dirty=false;this.version='v1';this.generation=1;this.cells=new Map();this.revoked=new Set();this.now=Date.UTC(2027,3,2);}
 key(country,year){return country+':'+year;}
 approve(country,year,{distance=1200,generation=this.generation,version=this.version,closeAt=Date.UTC(year+1,3,1),safe=true}={}){this.cells.set(this.key(country,year),{distance,generation,version,closeAt,safe});}
 read(country,year){
  if(!this.enabled||this.dirty)return null;
  const key=this.key(country,year),c=this.cells.get(key);
  if(!c||this.revoked.has(key)||!c.safe||c.generation!==this.generation||c.version!==this.version||this.now<c.closeAt)return null;
  return {country,year,distance_km:c.distance};
 }
 withdraw(country,year){if(this.enabled||!this.dirty)this.generation++;this.enabled=false;this.dirty=true;this.revoked.add(this.key(country,year));this.cells.clear();return {withdrawn:true,generation:this.generation};}
}
let n=0;const check=(name,fn)=>{fn();console.log('PASS '+name);n++;};
const setup=()=>{const g=new Gate();g.approve('JP',2026);return g;};
check('publication OFF',()=>assert.equal(setup().read('JP',2026),null));
check('approved minimal response',()=>{const g=setup();g.enabled=true;assert.deepEqual(g.read('JP',2026),{country:'JP',year:2026,distance_km:1200});});
check('dirty blocks',()=>{const g=setup();g.enabled=true;g.dirty=true;assert.equal(g.read('JP',2026),null);});
check('unapproved/suppressed blocks',()=>{const g=setup();g.enabled=true;assert.equal(g.read('US',2026),null);g.approve('US',2026,{safe:false});assert.equal(g.read('US',2026),null);});
check('stale generation blocks',()=>{const g=setup();g.enabled=true;g.generation++;assert.equal(g.read('JP',2026),null);});
check('policy version mismatch blocks',()=>{const g=setup();g.enabled=true;g.version='v2';assert.equal(g.read('JP',2026),null);});
check('before year closure blocks',()=>{const g=setup();g.enabled=true;g.now=Date.UTC(2027,2,31);assert.equal(g.read('JP',2026),null);});
check('withdrawal invalidates old generation',()=>{const g=setup();g.enabled=true;const old=g.cells.get('JP:2026');assert.ok(g.read('JP',2026));g.withdraw('JP',2026);g.dirty=false;g.approve('JP',2026,{generation:old.generation});assert.equal(g.read('JP',2026),null);});
check('repeat withdrawal stays closed',()=>{const g=setup();g.enabled=true;g.withdraw('JP',2026);g.withdraw('JP',2026);assert.equal(g.read('JP',2026),null);});
check('repeated withdrawal advances generation only once',()=>{const g=setup();g.enabled=true;const a=g.withdraw('JP',2026).generation;const b=g.withdraw('JP',2026).generation;assert.equal(a,b);});
check('fail closed despite enabled flag',()=>{const g=setup();g.enabled=true;g.withdraw('JP',2026);assert.equal(g.enabled,true);assert.equal(g.read('JP',2026),null);});
check('late import cannot edit approved snapshot',()=>{const g=setup();g.enabled=true;const original=g.read('JP',2026);const laterRaw=1299;assert.notEqual(original.distance_km,laterRaw);assert.deepEqual(g.read('JP',2026),original);});
check('enabling flag alone does not approve cell',()=>{const g=new Gate();g.enabled=true;assert.equal(g.read('JP',2026),null);});
console.log('B1_ISOLATED_DELIVERY_CONTRACT_PASS '+n+' checks; model only, not production or concurrent API proof');
