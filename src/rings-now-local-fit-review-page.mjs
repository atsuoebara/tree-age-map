// Source template only, NOT a public HTML entrypoint. Served exclusively from 127.0.0.1
// by scripts/serve-rings-now-local-review.mjs after future explicit owner authorization.
export function localReviewHtml() {
 return \`<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Rings Now | localhost FIT review</title>
<style>
:root{font-family:system-ui,-apple-system,sans-serif;color-scheme:dark;background:#101927;color:#edf4ff}
*{box-sizing:border-box}body{margin:0}.wrap{max-width:460px;margin:auto;padding:18px 16px 55px}
h1{font-size:1.6rem}p{line-height:1.7}.card{background:#203249;padding:16px;border-radius:12px;margin:14px 0}
.warn{background:#4a3724;border-left:4px solid #ffc785;padding:13px}
button,input{font:inherit}button{padding:10px 12px;min-height:48px;color:white;background:#286384;border:1px solid #98bfd9;border-radius:9px;margin:5px}
button:disabled{opacity:.45}input[type=file]{width:100%;max-width:100%;padding:12px 0}
label{display:block;margin:14px 0}input[type=checkbox]{width:22px;height:22px;vertical-align:middle}
table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #658099;padding:8px}
</style></head><body><main class="wrap">
<p>RUNNER’S RINGS · localhost / 開発者用</p><h1>Rings Now <small>NOW × KNOW</small></h1>
<p class="warn">本番未公開・実FIT使用未承認の隔離レビュー画面です。本人が実FIT使用を別途承認するまで実際のFITを選択しないでください。結果は未認証の参考候補です。</p>
<section class="card"><h2>① 仮のランを選択</h2><p>この画面は本番カレンダーに接続しません。架空のランだけで画面の選択・失効を確認します。</p>
<button type="button" id="selectDemo">仮ランを明示選択</button><p id="selected" role="status">未選択</p></section>
<section class="card"><h2>② FITを端末内で確認する部品</h2>
<input type="file" id="fileInput" accept=".fit,application/octet-stream">
<label><input type="checkbox" id="ownerCheckbox"> 自分のFITであることを確認</label>
<label><input type="checkbox" id="gachiCheckbox"> 自分で選んだガチランであることを確認</label>
<button type="button" id="reviewButton">端末内で確認</button>
<button type="button" id="cancelButton">選択と結果を消す</button>
<p id="statusNode" role="status" aria-live="polite">未選択</p><div id="lapsNode"></div>
</section><p>信号待ちやトイレ休憩、自動ポーズなどの影響により、正しく分析できない場合があります。</p>
<p>外部アップロード・保存・実カレンダー結線なし。停止時間を勝手に補正・除外しません。</p>
</main><script type="module">
import {createRingsNowIphoneIsolatedHandoff} from '/src/rings-now-iphone-isolated-handoff.mjs';
const $=id=>document.getElementById(id);
const nodes=Object.fromEntries(['fileInput','ownerCheckbox','gachiCheckbox','reviewButton','cancelButton','statusNode','lapsNode'].map(k=>[k,$(k)]));
let instance=null,context=null,selection=0;
const reset=()=>{
 instance?.destroy();instance=null;context=null;nodes.fileInput.value='';nodes.lapsNode.replaceChildren();
 nodes.ownerCheckbox.checked=false;nodes.gachiCheckbox.checked=false;nodes.statusNode.textContent='未選択';
};
$('selectDemo').addEventListener('click',()=>{
 reset();selection++;
 const now=Date.now(),start=new Date(now-1000*60*30).toISOString();
 const date=start.slice(0,10),token='demo-'+selection;
 context={currentUserId:'1',row:{id:1,user_id:1,started_at:start,activity_date:date,deleted_at:null},selectedAsGachiRun:true,selectionDate:date,selectionToken:token};
 instance=createRingsNowIphoneIsolatedHandoff({
  elements:nodes,document,readContext:()=>context,nowMs:()=>Date.now(),
  pageEvents:window,visibilityEvents:document,featureStartedAtMs:now-1000*60*60
 });
 $('selected').textContent='架空の30分前のランを選択（実カレンダーとは無関係）';
});
window.addEventListener('pagehide',reset);
window.addEventListener('pageshow',event=>{if(event.persisted)reset()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)reset()});
</script></body></html>\`;
}
