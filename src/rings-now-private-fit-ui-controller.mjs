// ISOLATED UI CONTROLLER ONLY — no HTML entrypoint imports this file.
// No access to production calendar, authentication services, network or storage.
import {inspectRingsNowPrivateFit} from './rings-now-private-fit-input-gate.mjs';

const DISCLAIMER='信号待ちやトイレ休憩、自動ポーズなどの影響により、正しく分析できない場合があります。';
const seconds=s=>{const n=Math.round(s);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};
const REQUIRED=['fileInput','ownerCheckbox','gachiCheckbox','reviewButton','cancelButton','statusNode','lapsNode'];
export function createRingsNowPrivateFitController({
  elements,document,isContextCurrent,inspect=inspectRingsNowPrivateFit,
}={}){
  if(!elements || REQUIRED.some(k=>!elements[k]) ||
     !document || typeof document.createElement!=='function' ||
     typeof isContextCurrent!=='function'||typeof inspect!=='function')
    throw new TypeError('controller dependencies or context guard missing');
  const e=elements;
  let generation=0,active=true,busy=false;
  const reset=(message='未選択')=>{
    generation++;busy=false;e.reviewButton.disabled=false;
    e.lapsNode.replaceChildren();e.statusNode.textContent=message;
  };
  const onFileChange=()=>{
    e.ownerCheckbox.checked=false;e.gachiCheckbox.checked=false;
    reset('ファイルを選択しました。本人・ガチランの確認が必要です');
  };
  const onConsentChange=()=>reset('確認内容が変更されました。再度操作してください');
  const onCancel=()=>{
    e.fileInput.value='';
    e.ownerCheckbox.checked=false;e.gachiCheckbox.checked=false;
    reset('取り消しました。結果は残していません');
  };
  const onReview=async()=>{
    if(!active||busy)return;
    e.lapsNode.replaceChildren();
    if(!isContextCurrent()){reset('画面の状態が変わりました。やり直してください');return;}
    const file=e.fileInput.files?.[0];
    if(!file){reset('FITファイルを1つ選んでください');return;}
    if(!e.ownerCheckbox.checked||!e.gachiCheckbox.checked){
      reset('本人とガチランの確認が必要です');return;
    }
    const currentGeneration=generation;
    const ownerConfirmed=e.ownerCheckbox.checked, gachiConfirmed=e.gachiCheckbox.checked;
    const current=()=>active && currentGeneration===generation &&
      isContextCurrent() && e.fileInput.files?.[0]===file &&
      e.ownerCheckbox.checked===ownerConfirmed &&
      e.gachiCheckbox.checked===gachiConfirmed;
    busy=true;e.reviewButton.disabled=true;
    e.statusNode.textContent='端末内で確認中…';
    try{
      const result=await inspect({
        file,confirmedOwner:ownerConfirmed,confirmedGachi:gachiConfirmed,
        isSelectionCurrent:current
      });
      if(!current())return;
      if(result?.status!=='reference_only_unverified'||
         result.analysisAllowed!==false||result.writeAllowed!==false||
         result.qualityCertified!==false||result.providerDataCombined!==false){
        e.statusNode.textContent='未認証の参考候補を表示できません。FITの内容を確認してください';
        return;
      }
      if(!Array.isArray(result.segments)||result.segments.length>300||
         result.segments.some(s=>!Number.isSafeInteger(s.index)||s.index<1||
           !Number.isFinite(s.clockElapsedS)||s.clockElapsedS<0)){
        e.statusNode.textContent='結果の形式が不正です。表示しません';return;
      }
      const table=document.createElement('table');
      for(const segment of result.segments){
        const row=document.createElement('tr');
        const label=document.createElement('td'),time=document.createElement('td');
        label.textContent=segment.partial?'端数区間（未認証）':segment.index+' km';
        time.textContent=seconds(segment.clockElapsedS);
        row.append(label,time);table.append(row);
      }
      e.lapsNode.replaceChildren(table);
      e.statusNode.textContent='参考候補・未認証（正式な分析結果ではありません）。'+DISCLAIMER;
    }catch{
      if(current())e.statusNode.textContent='端末内で確認できませんでした';
    }finally{
      if(active&&generation===currentGeneration){
        busy=false;e.reviewButton.disabled=false;
      }
    }
  };
  const handlers=[
    [e.fileInput,'change',onFileChange],
    [e.ownerCheckbox,'change',onConsentChange],
    [e.gachiCheckbox,'change',onConsentChange],
    [e.cancelButton,'click',onCancel],
    [e.reviewButton,'click',onReview],
  ];
  for(const [node,event,fn] of handlers)node.addEventListener(event,fn);
  return {
    // Caller MUST invoke invalidate() at logout, calendar switch, run deletion or route leave.
    invalidate(){
      onCancel();
    },
    destroy(){
      onCancel();active=false;
      for(const [node,event,fn] of handlers)node.removeEventListener(event,fn);
    }
  };
}
