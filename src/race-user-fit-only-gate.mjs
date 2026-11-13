// REVIEW-ONLY: synthetic, side-effect-free gate for user-supplied FIT records.
// Does NOT receive Strava data, match a Strava run, fetch any provider API,
// persist a file, or perform 1 km split analysis. Never import into production.
const okNumber=x=>typeof x==='number'&&Number.isFinite(x);
const blocked=reason=>({status:'blocked',reason,source:'user_fit_only',writeAllowed:false,analysisAllowed:false,providerDataCombined:false});
export function assessOwnFitForOfflineReview({userConfirmedFile=false,privateView=false,session,records,sourceProvenance='user_uploaded_fit',confirmRunning=false}={}){
 if(!userConfirmedFile||!privateView)return blocked('owner_confirmation_or_private_view_missing');
 if(sourceProvenance!=='user_uploaded_fit')return blocked('not_a_user_provided_fit');
 if(!session||session.sport!=='running'||!confirmRunning)return blocked('running_not_verified');
 if(!Array.isArray(records)||records.length<2||records.length>200000)return blocked('record_count_invalid');
 let priorTime=-Infinity,priorDistance=-Infinity;
 const sensors={heartRate:false,cadence:false,power:false};
 for(const record of records){
  if(!record||!okNumber(record.elapsedS)||!okNumber(record.distanceM))return blocked('time_or_distance_missing');
  if(record.elapsedS<=priorTime||record.distanceM<priorDistance||record.distanceM<0)return blocked('record_order_invalid');
  priorTime=record.elapsedS;priorDistance=record.distanceM;
  for(const [key,field] of [['heartRate','heartRate'],['cadence','cadence'],['power','power']]){
   const value=record[field];
   if(value!=null){
    if(!okNumber(value)||value<0)return blocked('sensor_value_invalid');
    sensors[key]=true;
   }
  }
 }
 if(priorDistance<=records[0].distanceM)return blocked('no_measured_distance_progress');
 return {
  status:'offline_shape_review',reason:'separate_fit_ownership_and_quality_review_required',
  source:'user_fit_only',recordCount:records.length,availableSensors:Object.keys(sensors).filter(k=>sensors[k]),
  missingSensors:Object.keys(sensors).filter(k=>!sensors[k]),
  writeAllowed:false,analysisAllowed:false,providerDataCombined:false
 };
}
