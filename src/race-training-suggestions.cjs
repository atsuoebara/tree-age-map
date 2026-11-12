'use strict';
// Pure, offline, deterministic suggestion helper. Not connected to production.
const TRAINING = Object.freeze({
  long_easy: {ja:'ゆっくり長く走る練習',en:'Easy long run',detailJa:'無理のない会話できる強度で、走る時間を徐々に延ばす一般的な練習。',detailEn:'Build endurance gradually at a comfortable, conversational effort.'},
  even_pace: {ja:'一定ペース走',en:'Even-paced running',detailJa:'走り始めを抑え、一定のペース感覚を練習する。',detailEn:'Practice starting conservatively and holding an even effort.'},
  easy_run: {ja:'イージーラン',en:'Easy running',detailJa:'負荷を抑えて走り、基礎的な持久力づくりに取り組む。',detailEn:'Easy running can support foundational endurance.'}
});
function suggestTraining(input) {
  const output={status:'insufficient_data',reason:'insufficient_data',recommendations:[],disclaimer:'General training information, not a diagnosis or personalized prescription.'};
  if(!input || !Array.isArray(input.splits) || input.splits.length<6) return output;
  const splits=input.splits;
  // Only complete 1 km splits with valid elapsed seconds; exclude a final partial segment.
  const complete=splits.filter(x=>x && x.distanceKm===1 && Number.isFinite(x.elapsedSeconds) && x.elapsedSeconds>0 && x.qualityOk===true);
  if (complete.length<6 || complete.length!==splits.filter(x=>x&&x.distanceKm===1).length) return output;
  const median=a=>{const s=[...a].sort((x,y)=>x-y);return s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2};
  const mid=Math.floor(complete.length/2);
  const first=median(complete.slice(0,mid).map(x=>x.elapsedSeconds));
  const last=median(complete.slice(mid).map(x=>x.elapsedSeconds));
  if (!(first>0) || !(last>0)) return output;
  const ratio=last/first;
  output.status='ok';
  output.observation={firstHalfMedianSeconds:first,secondHalfMedianSeconds:last,ratio:Number(ratio.toFixed(3)),basis:'Garmin elapsed time including stops, complete 1 km splits only'};
  if(ratio>=1.10){
    output.reason='later_splits_slower';
    output.recommendations=[{id:'long_easy',...TRAINING.long_easy},{id:'even_pace',...TRAINING.even_pace}];
  } else if(ratio<=0.90){
    output.reason='later_splits_faster';
    output.recommendations=[{id:'even_pace',...TRAINING.even_pace}];
  } else {
    output.reason='relatively_even';
    output.recommendations=[{id:'easy_run',...TRAINING.easy_run}];
  }
  return output;
}
if(typeof module!=='undefined' && module.exports) module.exports={suggestTraining,TRAINING};
