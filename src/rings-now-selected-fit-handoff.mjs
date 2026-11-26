// Candidate composition for the separately approved private FIT screen.
// No public entrypoint imports this module. A positive injected control response
// is not proof of deployment, authenticity, or permission to use real FIT.
import {createRingsNowIphoneIsolatedHandoff} from './rings-now-iphone-isolated-handoff.mjs';
import {inspectRingsNowPrivateFit} from './rings-now-private-fit-input-gate.mjs';
import {reviewSingleUserFitBuffer} from './race-fit-local-file-review.mjs';
import {reviewSelectedCalendarRun} from './ima-wo-shirou-calendar-selection-review.mjs';
import {reviewFitLinkForSelectedRun} from './ima-wo-shirou-fit-link-review.mjs';

const blocked=reason=>({status:'blocked',reason,analysisAllowed:false,writeAllowed:false});
const controlAllows=s=>s&&Object.keys(s).sort().join(',')==='build,enabled,protocol'&&
 s.protocol==='rings-now-review-v1'&&s.build==='v1'&&s.enabled===true;
export function createRingsNowSelectedFitHandoff({connection,elements,document,
 pageEvents,visibilityEvents,nowMs,featureStartedAtMs=null,
 realFitReadEnabled=false,requestControl=async()=>null}={}){
 if(!connection||typeof connection.readContext!=='function'||
    typeof connection.subscribeInvalidation!=='function'||!elements?.sameActivityCheckbox||
    typeof requestControl!=='function')throw new TypeError('confirmed calendar connection and explicit same-activity control required');
 const same=elements.sameActivityCheckbox;
 same.checked=false;
 const inspect=async({file,confirmedOwner,confirmedGachi,isSelectionCurrent})=>{
  const current=()=>same.checked===true&&isSelectionCurrent();
  if(realFitReadEnabled!==true||!confirmedOwner||!confirmedGachi||!current())
   return blocked('read_not_permitted');
  const context=connection.readContext();
  if(!context)return blocked('selection_missing');
  const eligibility=()=>reviewSelectedCalendarRun({
   row:connection.readContext()?.row,currentUserId:connection.readContext()?.currentUserId,
   selectedAsGachiRun:true,nowMs:nowMs(),featureStartedAtMs});
  if(eligibility().status!=='eligible_window_only')return blocked('window_closed');
  // Fixed control query; never pass a file, run ID, owner or FIT-derived value.
  let signal;
  try{signal=await requestControl()}catch{return blocked('control_unavailable')}
  if(!controlAllows(signal)||!current())return blocked('control_or_selection_invalid');
  return inspectRingsNowPrivateFit({file,confirmedOwner,confirmedGachi,
   isSelectionCurrent:current,review(buffer,options){
    const fit=reviewSingleUserFitBuffer(buffer,options);
    if(!current())return blocked('selection_changed');
    const link=reviewFitLinkForSelectedRun({calendarEligibility:eligibility(),fitReview:fit,
     userConfirmedSameActivity:same.checked===true,selectedRunId:String(context.row.id)});
    return link.status==='local_preview_only'?fit:blocked('same_activity_not_confirmed');
   }});
 };
 const handoff=createRingsNowIphoneIsolatedHandoff({elements,document,
  readContext:connection.readContext,nowMs,pageEvents,visibilityEvents,featureStartedAtMs,inspect});
 let destroyed=false,unsubscribe;
 const resetSame=()=>{same.checked=false};
 const invalidate=()=>{resetSame();handoff.invalidate()};
 const onSameChange=()=>{if(!same.checked)invalidate()};
 const onPageShow=e=>{if(e?.persisted)resetSame()};
 const onHidden=()=>{if(visibilityEvents.hidden)resetSame()};
 const bindings=[[same,'change',onSameChange],[elements.fileInput,'change',resetSame],
  [elements.cancelButton,'click',resetSame],[pageEvents,'pagehide',resetSame],
  [pageEvents,'pageshow',onPageShow],[visibilityEvents,'visibilitychange',onHidden]];
 try{
  unsubscribe=connection.subscribeInvalidation(invalidate);
  for(const [node,event,fn] of bindings)node.addEventListener(event,fn);
 }catch(error){
  unsubscribe?.();handoff.destroy();
  for(const [node,event,fn] of bindings)node.removeEventListener(event,fn);
  throw error;
 }
 return Object.freeze({invalidate,isContextCurrent:handoff.isContextCurrent,
  destroy(){if(destroyed)return;destroyed=true;resetSame();unsubscribe();
   handoff.destroy();for(const [node,event,fn] of bindings)node.removeEventListener(event,fn)}});
}
