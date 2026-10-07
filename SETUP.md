# GPS Art 道路候補生成 β版の反映手順

コードは作成済みです。道路APIキーとEdge Functionはまだ未登録で、実道路による生成は未検証です。

## 1. 道路APIキーを取得

https://openrouteservice.org/ から開発者アカウントへ進み、APIキーを作成します。無料枠のプランを選び、現在の利用上限を登録画面で確認してください。

取得したキーはチャットやGitHubへ貼りません。Supabaseの対象プロジェクトのEdge Functions → Secretsへ、Nameを ORS_API_KEY、Valueを取得したキーとして登録します。

## 2. Supabaseに関数を作成

関数名：gps-art-generate

supabase/gps-art-generate.ts の全内容を、その関数のindex.tsへ全文貼り付けしてデプロイします。「Verify JWT」はONにします。関数本体でもgetUserによりユーザーを確認しています。

既存の関数・DB・RLSの変更は不要です。SUPABASE_URLとSUPABASE_ANON_KEYはEdge Functionの標準環境変数を使います。

## 3. GitHubへ4ファイルを反映

- gps-art.html：全文差し替え
- gps-art-auth.js：全文差し替え
- gps-art-route.js：新規追加、上の2ファイルと同じ階層
- ROADMAP.md：全文差し替え

既存のgps-art-search.jsはそのまま必要です。このZIPでは変更していません。

コミットメッセージ：Add authenticated default-shape GPS Art road candidates

## 4. 実道路で確認

本体でログイン → GPS Art → 道路の近くに出発点を置いて確定 → デフォルト素材（最初は円）・5km・方角を選択 → 安全確認 → 制作条件を確認 → 候補ルートを作る。

オレンジ実線が候補、シアン点線が元の形です。点線は走行ルートではありません。実際の距離と、ピンから開始位置のずれを確認してください。

候補が作れない場合もあります。表示された理由に応じ、出発点・距離・形・方角を変えて試してください。実道路APIで検証するまでは完成扱いにしません。

## 今回の範囲

デフォルト4形の候補生成。自由入力・Gemini・許可済みキャラクター生成、保存、GPX出力、作品公開は未実装。サービスの利用上限・混雑・道路データの不足により失敗する場合があります。UIやサーバーは通行可否・安全を保証しません。

連続生成の制御はインスタンス内の簡易制御で、分散環境での厳密な回数制限ではありません。利用増加前の永続的な制限は次工程です。

## 検証済み

JavaScript構文、16通りの形と方角、サーバー認証拒否・匿名拒否、入力・外部エラー処理、UIのログイン・条件確認・条件変更時の遅延応答破棄、日英表示、既存の出発点・安全確認の模擬テスト。実道路API、今回の公開画面、スマホ表示は確認待ちです。

## 参照資料

- https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/requests-and-return-types
- https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/routing-options
- https://openrouteservice.org/restrictions/
- https://supabase.com/docs/reference/javascript/auth-getuser
- https://supabase.com/docs/guides/functions/auth-headers

