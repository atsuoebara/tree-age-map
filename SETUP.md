# Gemini無料枠・曲線元絵版

有料API版ZIPは使いません。追加のキー取得・題材別の設定は不要です。
Supabase側はgps-art-generate v15へ反映・取得照合済みです。

## 差し替えるもの

GitHubのatsuoebara/tree-age-mapへ、次の4ファイルを同じ名前で全文差し替えます。

1. gps-art.html
2. gps-art-route.js
3. gps-art-illustration.js
4. ROADMAP.md

コミットメッセージ：`Use Gemini curves for generic GPS art references`

SETUP.md、supabase、verificationフォルダーはアップロード不要です。
index.html、gps-art-view.js、認証/検索用ファイルは変更しません。

## 確認

ページ更新 → ログイン → 自由入力「犬」・5km・制作条件確認 → 下絵を作る。
薄い曲線の元絵とシアンの簡略化した輪郭を比較します。
元絵なしでも何の絵か分かるか、目などが適切な位置か確認します。
良ければ道路候補を作り、形がどこで変わったか比較します。
ニワトリ・魚・富士山などでも試してください。これは検証例で、題材の登録は不要です。

## 仕組みと限界

Geminiへ曲線と装飾の数値JSONを1回だけ要求し、共通コードで道路用8〜28点へ整理します。
短い距離の未指定動物は顔中心、長い距離は簡単な全身も可。明示した構図は尊重します。
特徴点と外周の上下左右の端を残し、交差・形の大きな変化を拒否します。
元絵の範囲外の装飾は省き、画面へ通知します。
入力テーマと距離はGeminiに送りますが、座標・メール・ユーザーIDは送りません。
道路APIへは輪郭点のみを送り、画像/目などは走行線に含めません。

既存モデル・キー・無料枠接続を維持。無料枠の上限と通信失敗は残ります。
課金設定の変更、有料APIへの切替、AIの自動再試行は追加しません。
旧outline/legacyアクションのニワトリ固定処理は互換用に残りますが、新curveは全題材でGeminiを使います。
道路の距離/方角判定は維持。DIRECTION_MISMATCH等をこの変更で解決したとは扱いません。

verificationにはコードのコピーとNodeテストを同梱しています。
test-curves、test-backend、test-ui、test-illustration、test-playerが合格。
これは模擬APIと数値図形での検証です。Gemini実生成の品質、実ブラウザー/iPhone、実道路成功率は未検証です。
