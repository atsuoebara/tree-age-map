// REVIEW-ONLY offline simulator for stale-tab/rollback scenarios.
// Never connects to a browser, a server, real FIT files, or production.
// Results are diagnostics, NOT a remote kill switch or real-FIT authorization.
import {evaluateSyntheticTabRetirement} from './rings-now-stale-tab-retirement-policy.mjs';

export function replaySyntheticTabScenario({initialBuild='v1',events=[]}={}){
 if(typeof initialBuild!=='string'||!initialBuild||!Array.isArray(events))throw new TypeError('synthetic initialBuild and events required');
 const tabs=new Map();
 let publishedBuild=initialBuild,revoked=false;
 const trace=[];
 const snapshot=(event)=>{
  const states=[];
  for(const [tabId,tab] of tabs){
   const evidence=evaluateSyntheticTabRetirement({
    loadedBuild:tab.loadedBuild,
    expectedBuild:tab.observedBuild,
    tabVisible:tab.visible,
    lifecycleRevoked:tab.lifecycleRevoked,
    rollbackDeclared:tab.rollbackKnown,
    freshSignalVerified:tab.freshSignalVerified
   });
   states.push({tabId,loadedBuild:tab.loadedBuild,observedBuild:tab.observedBuild,
    hasSeenWithdrawal:tab.rollbackKnown,
    visibility:tab.visible?'visible':'hidden',
    localDecision:evidence.status,
    mayReadRealFit:false,
    // Separate global fact from what the old tab knows: a cached old tab
    // cannot prove that it has stopped after an unseen rollout or rollback.
    remotelyRevokedGuaranteed:false,
    observationGap:tab.observedBuild!==publishedBuild||revoked!==tab.rollbackKnown
   });
  }
  trace.push({event,server:{publishedBuild,revoked},tabs:states});
 };
 for(const event of events){
  if(!event||typeof event!=='object')throw new TypeError('event object required');
  switch(event.type){
   case 'open':{
    if(typeof event.tabId!=='string'||!event.tabId||tabs.has(event.tabId))throw new TypeError('new unique synthetic tabId required');
    tabs.set(event.tabId,{loadedBuild:publishedBuild,observedBuild:null,visible:true,
     lifecycleRevoked:false,rollbackKnown:false,freshSignalVerified:false});
    break;
   }
   case 'publish':
    if(typeof event.build!=='string'||!event.build)throw new TypeError('new build required');
    publishedBuild=event.build;revoked=false;break;
   case 'withdraw':revoked=true;break;
   case 'receiveVerifiedSignal':{
    const tab=tabs.get(event.tabId);
    if(!tab)throw new TypeError('unknown tab');
    // Explicitly supplied trusted-fresh signal in this fake scenario.
    // It is NOT acquired/verified by the simulator.
    if(event.fresh!==true){tab.freshSignalVerified=false;break}
    tab.observedBuild=publishedBuild;tab.rollbackKnown=revoked;
    tab.freshSignalVerified=true;
    if(tab.loadedBuild!==publishedBuild||revoked)tab.lifecycleRevoked=true;
    break;
   }
   case 'hide':
   case 'pagehide':{
    const tab=tabs.get(event.tabId);if(!tab)throw new TypeError('unknown tab');
    tab.visible=false;tab.lifecycleRevoked=true;break;
   }
   case 'resume':{
    const tab=tabs.get(event.tabId);if(!tab)throw new TypeError('unknown tab');
    tab.visible=true; // never erase lifecycleRevoked
    break;
   }
   case 'close':if(!tabs.delete(event.tabId))throw new TypeError('unknown tab');break;
   default:throw new TypeError('unknown event type: '+String(event.type));
  }
  snapshot(event.type);
 }
 return {status:'simulation_only_no_authorization',trace,mayReadRealFit:false,mayEnableProduction:false,
  canGuaranteeRemoteTabRevocation:false};
}
