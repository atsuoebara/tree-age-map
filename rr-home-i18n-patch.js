/* English fallback for public landing copy; independent of run-data boot. */
(()=>{'use strict';
let en=false;try{en=localStorage.getItem('runners-rings-language')==='en'}catch(_){}
if(document.documentElement.lang==='en')en=true;
if(!en)return;
document.documentElement.lang='en';
const pairs=[
['※Runner’s Ringsへ実際に取り込まれたランニングデータをもとに集計します。','Calculated from running activities actually imported into Runner’s Rings.'],
['まずは','Start with '],

['で表示を確認してください。利用を始めたら、対応サービスとの連携やGPX・FITなどのファイル取り込みで自分のランを地図に表示できます。個人の走行ルートや記録は、本人が共有操作をしない限り一般公開しない設計です。','to see the app. Then connect a supported service or import GPX/FIT files to map your runs. Your routes remain private unless you explicitly share them.'],
['も確認できます。','for more information.'],
['※Runner\'s Ringsへ実際に取り込まれたランニングデータをもとに集計します。','Calculated from running activities actually imported into Runner\'s Rings.'],
['詳しい手順を見る →','View detailed instructions →'],
['Intervals.icu 初期登録＋データ連携ガイド','Intervals.icu sign-up and sync guide'],
['初期登録ガイド','Getting started guide'],
['Runner\'s Ringsの使い方と価値','How Runner\'s Rings works and why it matters'],
['FIT・GPX・TCX・ZIP','FIT / GPX / TCX / ZIP'],
['records,Preserve','records, Preserve'],
['ペースや順位だけでは残しきれない「どこを走ってきたか」を、道・地域・年の積み重ねとして振り返れます。','Look beyond pace and race results: revisit the roads, regions and years that make up your running journey.'],
['昔のランも取り込めば、これまでのランニングそのものが一枚の地図に育っていきます。','Import older runs too, and your entire running history grows into one map.'],
['トレーニング分析とは、少し違う役割。','A different perspective from training analytics.'],
['StravaやIntervals.icuなどで日々のトレーニングを管理しながら、Runner\'s Ringsでは「走った場所の積み重ね」を残す。 速さだけではなく、走ってきた街や道もランニングの歴史として楽しむためのサービスです。','Keep analyzing workouts in Strava or Intervals.icu while Runner\'s Rings preserves the places you explored, not just your speed.'],
['次はどこを走ろう。','Where will you run next?'],
['未走破の市町村や、まだ色の付いていない地域が見えると、いつものランに新しい目的が生まれます。 Runner\'s Ringsは、過去を残すだけでなく、次の一本を考えるための地図でもあります。','Unexplored towns and uncolored regions give your next run a new purpose. Your map can inspire future routes too.'],
['アクセス解析を見ると、Runner\'s Ringsには国内外から毎日訪れてくださる方がいます。とても励みになっています。','It\'s encouraging to see runners from Japan and overseas visiting Runner\'s Rings every day.'],
['使う人の不安を減らそうと説明を足してきたら、少し多くなったかもしれません。自分だけでは気づけない迷いや分かりにくさを、これまで多くの方に教えていただきました。','I\'ve added explanations to help users feel confident, perhaps a few too many. Feedback has helped me find confusing parts I couldn\'t see on my own.'],
['個人開発だからこそ、使う人の声を聞きながら、みんなで少しずつ育てるアプリにしたいと思っています。','As an independent developer, I want to keep improving this app together with the people who use it.'],
['Rings Ranking・Rings Territoryを試して、つまずいたところを教えてくださる方を募集中です。','We\'re looking for runners to try Rings Ranking and Rings Territory and share what they find confusing.'],
['連携で迷ったらQ&Aを見る ↗','Need help connecting? See the FAQ ↗'],
['取り込み方法の利用割合を見る','See how runners import their activities'],
['現在のデータ取り込み割合','Current import method distribution'],
['※StravaとIntervals.icuは、基本的にどちらか一方を選んで連携してください。','Note: Generally, choose either Strava or Intervals.icu to avoid duplicate imports.'],
['Strava、Intervals.icu、COROS、FIT・GPX・TCX・ZIPなどから取り込めます。','Import runs from Strava, Intervals.icu, COROS or FIT, GPX, TCX and ZIP files.'],
['Journalの記事一覧を見る','Browse Journal articles'],
['世界のランナーの記録を見る','Explore runners around the world'],
['市町村ごとの順位を見る','Explore local rankings'],
['Passwordを忘れた方','Forgot your password?'],
['パスワードを忘れた方','Forgot your password?'],
['使い方を見る','How to use'],
['開発者からのメッセージ','Developer message'],
['走った道を重ねる','Layer the roads you have run'],
['地域走破を楽しむ','Explore new regions'],
['ALLと年別で振り返る','View ALL or individual years'],
['走破マップをシェア','Share your exploration map'],
['実際に走ったコースと、繰り返し走ったエリアを地図で確認。広域の「面」と詳細な「コース」を切り替えて見られます。','See both your routes and the areas you run repeatedly. Switch between area and route views.'],
['日本では都道府県から市町村へ。走破数・走破率・残りの地域が分かり、「次はどこを走ろう」が見つかります。','Explore Japan by prefecture and municipality. Track visited and remaining areas to plan your next run.'],
['これまで全部の積み重ねと、その年に走った記録を分けて表示。同じ街でも毎年違う広がりを楽しめます。','See your entire running history or focus on one year at a time.'],
['都道府県や国の走破状況を、地域だけを切り出した専用画像で共有。走破した地域はRunner\'s Ringsカラーで表示されます。','Share images showing the countries or prefectures you have explored.'],
['Runner\'s Ringsをはじめる','Start with Runner\'s Rings'],
['ログインすると、','Log in to'],['あなたのランニングマップを表示します。','view your running map.'],
['初めて使う場合は「新規登録」から。','New here? Choose Sign up.'],
['メールアドレス','Email address'],['パスワード','Password'],
['新規登録','Sign up'],['ログイン','Log in'],
['パスワードは6文字以上で設定してください。','Use a password with at least six characters.'],
['新規登録後、Supabase Authから確認メールが届きます。','A confirmation email will be sent after registration.'],
['メール内の「Confirm email address」をタップすると登録が完了します。','Tap Confirm email address in the email to complete registration.'],
['データ連携・取り込み方法','Connect services and import runs'],
['Strava経由','Via Strava'],['Intervals.icu経由','Via Intervals.icu'],['COROSから直接','Direct from COROS'],['自動連携','Automatic sync'],
['気づいたことを伝える・質問する ↗','Send feedback or ask a question ↗'],
['日本・海外どちらからでも歓迎です。','Runners from around the world are welcome.'],
['走った記録ではなく、','Not just your running records,'],
['走った人生を残す。','Preserve the life you ran.'],
['Runner\'s Rings（ランナーズリングス）は、','Runner\'s Rings is'],
['あなたが走った道や街を地図に積み重ねていく','a running app that maps the routes and places'],
['ランニング記録アプリです。','you have explored over time.'],
['🔒 距離・ラン数・地図は、登録した本人だけに表示されます。','🔒 Your distance, activity count and personal map are private to your account.'],
['シェアするかどうかは、自分で選べます。','You decide what to share.'],
['登録なしでサンプルを見る','View sample without signing up'],
['🎬 月間振り返り動画とは？','🎬 Monthly recap videos'],
['ログイン・新規登録','Log in / Sign up'],
['Strava・Intervals.icu・COROSや、FIT／GPX／TCXファイルからランニング記録を取り込めます。','Import your activities from Strava, Intervals.icu, COROS or FIT/GPX/TCX files.'],
['🗺️ あなたの走った地図は、ここから','🗺️ Your running map starts here'],
['ランニングデータを取り込むと、走った道が線で描かれ、走った地域に色がついていきます。年月を重ねるほど、あなただけの地図が育ちます。','Import running data to trace your routes and color the places you have visited. Your personal map grows with every year.'],
['これは記録の入っていない地図です。あなたの位置情報やランニングルートは公開されません。','This is an empty sample map. Your location and routes are not published.'],
['無料で始めて、自分の地図を育てる →','Get started for free →'],
['走った道を、年輪として残す理由','Why preserve your running routes as growth rings?'],
['毎週走る家の近くの道、旅先で初めて通った街、大会で挑戦したコース。ランニングの記録は距離やペースだけではありません。Runner\'s Ringsは走ったルートを地図に重ね、年月とともに広がる自分だけの足跡を残すためのアプリです。何度も走った道も、初めて走った道も、後から振り返ると違った意味を持ちます。','Your familiar neighborhood routes, new streets explored while traveling, and courses tackled on race day are more than pace and distance. Runner\'s Rings brings those routes onto one map to preserve a journey that grows over time.'],
['どんな人が、どう使う？','Who is it for, and how can you use it?'],
['いつもの練習場所がどれだけ広がったか見たいランナーは、年・月別の地図で変化を確認できます。旅行や大会で訪れた地域を残したい人は、走破した場所を地図で振り返れます。長く走り続けている人なら、過去の記録を取り込み、何年にもわたるランニングの積み重ねを一枚の地図で見ることができます。','Compare your running maps by year or month, revisit regions explored during travel and races, or import older activities to see years of running history on one map.'],
['始め方とプライバシー','Getting started and privacy'],
['登録不要のサンプル','sample without registration'],
['プライバシーについて','Privacy policy'],
['Journalでは開発の過程も公開中。','Read about the development journey in Rings Journal.'],
['機能をつくった理由、失敗と修正、ランニングの実体験を','Explore why features were built, what was fixed, and first-hand running stories in'],
['に掲載しています。',' .'],
['RINGS JOURNAL｜ランニングと開発の記録','RINGS JOURNAL | RUNNING & DEVELOPMENT'],
['走った人の経験から、ランニングを考える','Running through the experiences of runners'],
['Runner\'s Ringsの開発記録だけでなく、実際に走った体験やレースについて、作り手自身の視点で綴っています。気になる記事からお読みください。','Stories about developing Runner\'s Rings, running experiences and races, told from the creator\'s perspective.'],
['最新の記事は公開のたびに','New stories are added to the'],
['Journal一覧','Journal index'],
['に追加されます。ニュースの紹介だけでなく、機能を作った理由、修正の経緯、実際のランニング体験も公開しています。','as they are published, including development decisions, improvements and running experiences.'],
['Runner\'s Ringsでできること','What you can do with Runner\'s Rings'],
['走った歴史を、一枚の地図に。','Your running history on one map'],
['登録者','Members'],['登録ラン','Runs'],['総走行距離','Total distance'],['国別走行距離','Distance by country'],
['各ランの全距離をスタート地点の国に集計しています。','Each run is counted toward the country where it began.'],
['Runner\'s Ringsとは？','About Runner\'s Rings'],['開発者からのメッセージ','Developer message'],['使い方','How to use'],['利用規約','Terms'],['お問い合わせ','Contact'],['プライバシーポリシー','Privacy policy']
].sort((a,b)=>b[0].length-a[0].length);
function translateText(node){if(!node.nodeValue||!/[ぁ-んァ-ヶ一-龯]/.test(node.nodeValue))return;
const parent=node.parentElement;if(!parent||parent.closest('script,style,textarea,select,[data-lang="ja"]'))return;
let value=node.nodeValue;for(const [ja,enValue] of pairs)value=value.split(ja).join(enValue);
if(value!==node.nodeValue)node.nodeValue=value;}
let busy=false;
function scan(){if(busy)return;busy=true;
try{const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(translateText);
document.querySelectorAll('[aria-label],[title],[placeholder]').forEach(el=>{for(const attr of ['aria-label','title','placeholder']){if(!el.hasAttribute(attr))continue;let v=el.getAttribute(attr);for(const [ja,enValue] of pairs)v=v.split(ja).join(enValue);el.setAttribute(attr,v);}});
}finally{busy=false}}
scan();
const intro=document.querySelector('#publicRunningGuide p:nth-of-type(1)');
const users=document.querySelector('[data-public-stat="users"]');if(users){const unit=users.querySelector('strong + span');if(unit)unit.textContent='people';}
const guide=document.querySelector('.intervalsGuide');if(guide){guide.querySelectorAll('img').forEach(img=>{img.style.display='none';});const hint=document.createElement('p');hint.textContent='For current English-language setup steps, please consult the Intervals.icu instructions.';guide.append(hint);}
let scheduled=false;const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;scan()})});
observer.observe(document.body,{childList:true,subtree:true});
})();