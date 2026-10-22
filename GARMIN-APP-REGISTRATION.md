# Garmin Add app 入力値と残作業（2026-10-22）

確認元: main `602407ca31e3b6085e7e29eeeb698b55f8d00f14` の ROADMAP.md / index.html / privacy.html / CNAME、および公開済みSupabase関数一覧。
既存ロードマップのGarminはConnect IQの連携コード方式であり、Connect Developer OAuthとは別。

| フォーム | 入力値 |
| --- | --- |
| App name | Runner's Rings |
| Company Website | https://runnersrings.com |
| OAuth redirect URL | https://fhwvntpzwyenendhcgbw.supabase.co/functions/v1/garmin-oauth/callback |
| Branding image URL | https://fhwvntpzwyenendhcgbw.supabase.co/functions/v1/garmin-oauth/logo.png |
| Privacy policy | https://runnersrings.com/privacy.html |
| データ販売 | No |
| Product | 参照画像では Connect Developer - Starter |

コールバックとロゴはSupabaseに実装・公開済み。ロゴは既存icon.PNG（1254×1254）を300×300に縮小したPNG。ロゴURLのGETは200 / image/pngを確認。コールバックはパラメーターなしで400、不完全な登録設定では503となり、成功したようには表示しない。実在する配信先であり、URLを推測していない。

## 申請前

- この変更のprivacy.htmlをmainへ反映し、本番で `#garmin-data` の記述が公開されたことを確認する。旧版はGarminを記載していないため、そのままの状態で要件を満たすとは扱わない。
- 添付フォームが求める用途、全処理事業者、販売・共有、AI利用、アクセス・訂正・削除・エクスポート・同意撤回を日英で追加した。Garmin APIは準備中と明記している。
- GarminデータはSupabaseで処理・保存。画面のホスティングはGitHub Pages、地図はOpenStreetMap / Leaflet。Garminデータを販売・広告目的で提供せず、AI処理・学習・評価・改善にも使用しない方針。将来この方針を変える場合は、Garmin契約と明示的同意を含めて再確認する。

## アプリ登録後（認証情報はチャットやGitに貼らない）

SupabaseのSecretsに次を登録する。既存StravaのSecretsを変更しない。

- `GARMIN_CLIENT_ID`: 登録したGarminアプリが発行する値
- `GARMIN_CLIENT_SECRET`: 同アプリが発行する値
- `GARMIN_TOKEN_KEY`: 暗号学的乱数32バイトを64桁の16進文字列で表した値。Cookieと保存トークンのAES-GCM暗号化に使用。変更時は既存暗号文の移行が必要。

SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEYはEdge Functionsのサーバー環境変数を使用する。秘密値はブラウザへ渡さない。

認証の開始は、ログイン済みのrunnersrings.com画面から、`/functions/v1/garmin-oauth/start` へトップレベルのPOSTフォームで `access_token`（Supabaseの利用者セッションJWT）を送る。JWTをURLへ含めない。サーバーが利用者を照合し、10分有効の暗号化HttpOnly CookieとPKCE S256を作り、Garminへ303リダイレクトする。戻り先ではCookie・state・有効期限を照合し、コードを交換してGarminユーザーIDと権限を取得する。成功後だけアプリへ戻る。

解除も同じオリジンのログイン済み画面から `/functions/v1/garmin-oauth/disconnect` へ同形式のPOSTを送る。期限が近ければトークンを更新し、Garmin登録解除APIの成功後に専用連携行を削除する。保存済みランの削除は別途依頼する。

**アカウント設定に接続・解除ボタンを追加済み（Build 2026.10.22.02）。** 本人の接続状態のみを返す認証済みstatus APIを使用する。実Garminアカウントによる許可・拒否・解除・再接続は利用者と確認する。アクティビティ同期、通知エンドポイント、Garmin側での権限変更通知・登録解除通知の処理は今回の対象外で未実装。まだ自動同期が使えると案内しない。

## 分離と検証

- 新しい関数はgarmin-oauthのみ。既存strava-oauth / sync / status / disconnect / webhook、Connect IQ用garmin-link / ingestを変更していない。
- 新しいテーブルはgarmin_api_connectionsのみ。既存garmin_connectionsやrunsに触れない。RLS有効、anon/authenticated権限なし、service_roleのみアクセス。tokens_ciphertextはアプリ側でも暗号化。RLSポリシーなしのINFOは、利用者の直接アクセスを許可しない意図した構成。
- `node scripts/test-garmin-oauth.mjs` 合格。未設定、Origin拒否、PKCE、Cookie、state不一致、有効期限、改ざん、認可拒否、暗号化保存、解除API、PNG実寸を検証。
- `node check-index.js` は既存「選択ランの青線設定」の2項目で失敗。check-index.jsと選択ラン描画は基準コミットと同一。index.htmlは接続ボタンと初期化・Buildを追加した。既存の選択ラン描画とチェックの不一致は別件。
- 利用者によるアプリ登録と認証情報・暗号鍵の保存は完了。実アカウントでの操作が必要なため、実サービスでの認可コード交換・トークン更新・解除は未確認。モック検証のみ。Add appは利用者が送信済みで、Key Status Approvedを確認。

公式OAuth仕様: https://developerportal.garmin.com/sites/default/files/OAuth2PKCE_1.pdf

コミットメッセージ:
`feat: Garmin専用OAuthコールバックと申請用ロゴ・プライバシー説明を追加`
