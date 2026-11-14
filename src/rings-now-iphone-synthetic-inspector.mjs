// Synthetic ONLY. This is not a general-purpose real FIT input adaptor.
// Reject any file whose exact 294 bytes differ from the approved public fixture
// BEFORE invoking the existing isolated FIT parser or any supplied delegate.
import {inspectRingsNowPrivateFit} from './rings-now-private-fit-input-gate.mjs';
export const SYNTHETIC_NAME='rings-now-synthetic-5km.fit';
export const SYNTHETIC_SIZE=294;
export const SYNTHETIC_SHA256='24c29cacc088ee2cb2a43f82402d88dfd222a389da98f7b37704e87ba64163aa';
const blocked=reason=>({status:'blocked',reason,qualityCertified:false,analysisAllowed:false,writeAllowed:false,providerDataCombined:false});
const toHex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
export function createSyntheticOnlyInspector({digest,inspect=inspectRingsNowPrivateFit}={}){
 if(typeof digest!=='function'||typeof inspect!=='function')throw new TypeError('digest and inspect required');
 return async ({file,confirmedOwner=false,confirmedGachi=false,isSelectionCurrent}={})=>{
  if(!confirmedOwner||!confirmedGachi)return blocked('confirmation_required');
  if(typeof isSelectionCurrent!=='function'||!isSelectionCurrent())return blocked('selection_changed');
  if(file?.name!==SYNTHETIC_NAME||file?.size!==SYNTHETIC_SIZE||typeof file?.arrayBuffer!=='function')
   return blocked('not_approved_synthetic_file');
  try{
   const bytes=await file.arrayBuffer();
   if(!isSelectionCurrent())return blocked('selection_changed');
   if(!(bytes instanceof ArrayBuffer)||bytes.byteLength!==SYNTHETIC_SIZE)return blocked('invalid_bytes');
   const sum=toHex(await digest('SHA-256',bytes));
   if(!isSelectionCurrent())return blocked('selection_changed');
   if(sum!==SYNTHETIC_SHA256)return blocked('hash_mismatch_no_decode');
   // The original file is never passed downstream. The verified clone can only
   // yield the exact approved synthetic bytes and is guarded against stale UI.
   return await inspect({
    file:{name:SYNTHETIC_NAME,size:SYNTHETIC_SIZE,arrayBuffer:async()=>bytes.slice(0)},
    confirmedOwner,confirmedGachi,isSelectionCurrent
   });
  }catch{return blocked('synthetic_file_read_failed')}
 };
}
