// Synthetic-only, isolated simulation. NOT imported by public or production code.
// Model observes explicitly injected messages. It never fetches, stores, or reads FIT.
// Absence of a delivered signal DOES NOT imply an old open tab has stopped.
import {evaluateSyntheticTabRetirement} from './rings-now-stale-tab-retirement-policy.mjs';
export function createOpenTabRolloutSimulation({initialBuild='v1'}={}){
 if(typeof initialBuild!=='string'||!initialBuild)throw new TypeError('initialBuild required');
 let publishedBuild=initialBuild;
 let withdrawn=false;
 let nextId=0;
 const tabs=new Map();
 const counts={delivered:0,missed:0};
 function snapshot(tab){
  const knowledge=tab.knownBuild;
  const check=evaluateSyntheticTabRetirement({
   loadedBuild:tab.loadedBuild,
   expectedBuild:knowledge,
   tabVisible:tab.visible,
   lifecycleRevoked:tab.revoked,
   rollbackDeclared:tab.knowsWithdrawn,
   freshSignalVerified:tab.hasFreshSignal&&!tab.knowsWithdrawn
  });
  // A "not blocked" snapshot is NOT permission. Even if it was never told
  // about withdrawal, that does not establish safety in the actual world.
  return Object.freeze({
   id:tab.id,loadedBuild:tab.loadedBuild,knownBuild:knowledge,
   visible:tab.visible,revoked:tab.revoked,knowsWithdrawn:tab.knowsWithdrawn,
   hasFreshSignal:tab.hasFreshSignal,
   globallyWithdrawn:withdrawn,
   globallyCurrentBuild:publishedBuild,
   simulatedStatus:check.status,
   failures:check.failures,
   verifiedSafe:false, // simulation cannot verify production safety
   realFitAllowed:false,productionAllowed:false,
   oldTabGuaranteedStopped:false
  });
 }
 const requireTab=id=>{const t=tabs.get(id);if(!t)throw new TypeError('unknown simulated tab');return t};
 return Object.freeze({
  open({build=publishedBuild}={}){
   if(typeof build!=='string'||!build)throw new TypeError('tab build required');
   const id=++nextId;
   tabs.set(id,{id,loadedBuild:build,knownBuild:null,visible:true,revoked:false,knowsWithdrawn:false,hasFreshSignal:false});
   return id;
  },
  publish(build){if(typeof build!=='string'||!build)throw new TypeError('build required');publishedBuild=build;withdrawn=false},
  withdraw(){withdrawn=true},
  hide(id){const t=requireTab(id);t.visible=false;t.revoked=true},
  show(id){requireTab(id).visible=true}, // never revives revoked state
  pagehide(id){requireTab(id).revoked=true},
  pageshow(id,{persisted=false}={}){if(persisted)requireTab(id).revoked=true},
  invalidate(id){requireTab(id).revoked=true},
  // Injected verified control signal in this synthetic simulation only.
  // Real-world old tabs cannot be forced to call observe().
  observe(id){
   const t=requireTab(id);
   t.knownBuild=publishedBuild;
   t.knowsWithdrawn=withdrawn;
   t.hasFreshSignal=true;
   counts.delivered++;
   return snapshot(t);
  },
  // Represents unavailable network or an old tab that never checks. No update.
  miss(id){requireTab(id);counts.missed++;return snapshot(requireTab(id))},
  inspect(id){return snapshot(requireTab(id))},
  stats(){return Object.freeze({...counts,openTabs:tabs.size,withdrawn,publishedBuild})}
 });
}
