// REVIEW-ONLY building block for a future iPhone-local user-selected FIT flow.
// Not imported into index.html or any published HTML. No network, storage, DB,
// automatic calendar association, diagnosis or production feature activation.
import {reviewSingleUserFitBuffer} from './race-fit-local-file-review.mjs';

const denied=reason=>({status:'blocked',reason,qualityCertified:false,analysisAllowed:false,writeAllowed:false,providerDataCombined:false});
const MAX_BYTES=16*1024*1024;
const validFile=file=>file!=null && typeof file.name==='string' &&
  /\.fit$/i.test(file.name) && Number.isSafeInteger(file.size) &&
  file.size>=16 && file.size<=MAX_BYTES && typeof file.arrayBuffer==='function';

// The caller must supply an active-selection check. Do not identify a stored run
// by date/distance/name or use this result as eligibility for the 8-day feature.
export async function inspectRingsNowPrivateFit({
  file,confirmedOwner=false,confirmedGachi=false,isSelectionCurrent,
  review=reviewSingleUserFitBuffer,
}={}){
  if(!confirmedOwner||!confirmedGachi)return denied('confirmation_required');
  if(!validFile(file))return denied('fit_file_invalid');
  if(typeof isSelectionCurrent!=='function')return denied('selection_guard_required');
  let buffer;
  try {
    if(!isSelectionCurrent())return denied('selection_changed');
    buffer=await file.arrayBuffer();
    if(!isSelectionCurrent())return denied('selection_changed');
    if(!(buffer instanceof ArrayBuffer)||buffer.byteLength!==file.size)
      return denied('file_bytes_invalid');
    const result=review(buffer,{confirmedOwner:true,confirmedRace:true});
    if(!isSelectionCurrent())return denied('selection_changed');
    if(result?.status!=='candidate_unverified'||result.qualityCertified!==false||
       result.analysisAllowed!==false||result.writeAllowed!==false||
       result.providerDataCombined!==false)return denied('not_an_unverified_candidate');

    // Explicit output allowlist. No raw FIT, timestamps, GPS, HR, device/athlete IDs.
    const segments=Array.isArray(result.segments)?result.segments.map(s=>({
      index:s.index,distanceM:s.distanceM,clockElapsedS:s.clockElapsedS,partial:s.partial===true
    })):[];
    if(segments.length>300 || segments.some(s=>!Number.isSafeInteger(s.index)||
       s.index<1 || !Number.isFinite(s.distanceM)||s.distanceM<0||
       !Number.isFinite(s.clockElapsedS)||s.clockElapsedS<0))
      return denied('invalid_segments');
    return {status:'reference_only_unverified',segments,
      flags:Array.isArray(result.flags)?result.flags.filter(s=>typeof s==='string').slice(0,64):[],
      qualityCertified:false,analysisAllowed:false,writeAllowed:false,providerDataCombined:false};
  }catch{
    return denied('local_read_failed');
  }finally {
    // No caching or persistence. Local references become unreachable on return.
    buffer=null;
  }
}
