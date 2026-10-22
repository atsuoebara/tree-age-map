# Runner’s Rings Garmin自動取り込み 引き継ぎ書

作成日：2026年10月22日（日本時間）  
対象：`atsuoebara/tree-age-map` / Garmin Connect Activity API Starter Push

## 1. 現在の到達点

**実装、本番への反映、モックテスト、実DBのロールバックテストは完了。実Garmin通知を受信してランを保存する一連の実機確認は未完了。**

「自動連携がすべて完成」「残りは何もない」と説明しないこと。通知形式・運用上の制約と、下記の未検証項目が残っている。

この書類は本会話で最後に確認した状態の記録。次回は本番の関数バージョン、Inbox、PRの状態を再確認する。

## 2. 作業場所・参照先

- リポジトリ：<https://github.com/atsuoebara/tree-age-map>
- 既存PR：<https://github.com/atsuoebara/tree-age-map/pull/6>（最後の確認ではopen / draft、未マージ）
- ブランチ：`feature/garmin-activity-push`
- 実装の最新コミット：`9f2952e` — `feat(garmin): schedule durable retries and enforce current consent`
- 先行修正：`62bad96` — `fix(garmin): harden push intake and preserve distinct runs`
- 確認・反映済みmain：`c08e55607d5ef12686e3a434ad51d2d7938441ce`
- ローカル：`C:/Users/a-ebara/.codex/.chatgpt-projects/g-p-6a9992f5e074819183c09940dd84988d/implementation`
- Supabaseプロジェクト：`fhwvntpzwyenendhcgbw`
- 詳細設計・運用：`GARMIN-ACTIVITY-PUSH.md`
- 進捗：`ROADMAP.md`冒頭の「current status」が最新。それ以降のhistorical節は過去の記録。

## 3. 絶対に維持する条件

- **GARMIN_TOKEN_KEYを上書きしない。** 既存の暗号化トークンを復号できなくなる。
- 秘密値、service_role、Client Secret、Pushの秘密URLを会話・Git・ログへ出さない。
- 既存Strava、Connect IQ、既存runsを壊さない。今回はこれらの既存コードや既存ランを変更していない。
- `sources/`以下は読み取り専用の同期資料。編集・移動・削除しない。
- ユーザーは不要な確認待ちを嫌う。必要な実機操作だけを短く依頼する。
- 本番反映済みなので、「PRがdraftだから未稼働」と判断しない。

## 4. 実装・反映済み

### 受信・保存・重複防止

- `garmin-activity-push`：最後に確認した本番は**v5 / ACTIVE**。
- Pushの秘密パスを検証。任意のclient-IDヘッダーがある場合も検証。受信データは8MB上限。
- バッチ全体を検証し、`garmin_activity_inbox`へ永続化してからHTTP 200。DB障害は503として再配信を求める。
- 対象はGPSを持つランニング系。手入力、親活動、対象外種目、GPS不足は取り込まない。
- 接続世代・処理回数を照合し、接続確認、重複判定、runsへの保存、Inbox完了を一つのDB処理にまとめた。
- 同じGarmin活動IDの再配信を防止。削除済みランも再作成しない。同日・近距離でも別Garmin IDは保持する。
- 他ソースとの照合は開始時刻2分以内、距離差3%以内（最低100m）。同時Strava保存や開始時刻のない古い記録まで重複防止を保証するものではない。
- 処理済みのInboxには生GPSを残さず、受信メタデータを保持。

### 再試行・権限・解除

- `garmin-activity-retry`：**2分ごと**のpg_cronを有効化済み。
- 専用の256bit認証情報をDB内で生成してVaultに保管。値を取得・表示・コミットしていない。既存secretは上書きしていない。
- 中断された処理は6分後に回収。再試行間隔は1分から最大6時間。トークン更新の重複を5分の処理ロックで防止。
- Garminの`GET /user/permissions`で実際の現在権限を照会。2分より古い権限情報では保存しない。照会障害時は取り込みを保留して再試行。
- `deregistrations` / `userPermissionsChange`は権限の再照会を促すヒントとして受け付ける。通知の本文だけで権限付与・登録削除を決定しない。通知欠落時も定期照会する。
- `garmin-oauth`：最後に確認した本番は**v7 / ACTIVE**。
- 解除は先にローカル取り込みを停止。Garmin側の解除が失敗した場合は暗号化認証情報を保持して定期再試行する。
- 再接続時は接続世代を変え、古い待機データをキャンセルする。
- クライアントから内部RPCを呼べない権限設定、RLS、秘密値比較用の非公開スキーマを追加済み。

## 5. 検証済みの証拠

### モック・DB検証

- `node scripts/test-garmin-push.mjs`：通過。
- `node scripts/test-garmin-oauth.mjs`：通過。
- `node scripts/test-garmin-controls.mjs`：通過。
- `scripts/test-garmin-database.sql`：本番DB上でservice_role権限を使い、単一トランザクション内で通過。最後にROLLBACK。
- DBテスト対象：受信と保存の重複防止、古い処理の拒否、削除済みラン、別活動、他ソース照合、再接続、権限撤回、解除、RPC権限。
- 模擬ユーザー・ラン・トリガー送信要求は永続化していない。採番値は進む場合がある。
- デプロイ後に取得したPush/OAuthソースと、テストしたローカルソースの一致を確認。

### 実環境で確認したこと

- Vault認証付きの実worker POST：HTTP 200、タイムアウトなし。
- 既存アカウントのGarmin権限GET：成功、`ACTIVITY_EXPORT`を確認。
- 定期ジョブ：2026-10-22 13:46 / 13:48 / 13:50 JSTに成功。13:50:03 JSTに権限確認時刻が進んだ。
- 不正なPushパス：404。認証なしdrain：403。正しいOriginなしのOAuth status：403。
- 最後の確認時点：**Inbox 0件、既存API接続1件。実ランの取り込み成功は確認していない。**
- Security / Performance advisorsを確認。今回追加したGarminの公開SECURITY DEFINER警告はなし。サービス専用RLSの情報表示、空Inboxの未使用インデックス表示は残る。既存の無関係な警告は変更していない。

## 6. 未検証・残作業（次はここから）

1. ユーザーに新しいGPSランをGarmin Connectへ同期してもらい、実通知→Inbox→runs保存を確認する。
2. Garmin側のActivity Details配信先・有効状態・本番の利用制限を確認する。秘密URLの値は取り出して共有しない。
3. 受信後、Garmin活動ID、日付、距離、GPSルート、所属ユーザー、Inboxのstateを照合する。
4. 同じ通知を再送してランが増えないこと、同日の別ランが残ることを確認する。
5. 権限変更・登録解除通知の実際のJSONと配信を確認する。実アカウントの権限撤回・解除・再接続はユーザー参加で行う。
6. 実際の通知障害からの再配信、2セッション同時配信を確認する。モックや単一トランザクションテストを実機・実同時実行テストと呼ばない。
7. 結果に応じてROADMAPとPRを更新し、初めて実機確認完了とする。PRのマージはまだ行っていない。

最初に依頼する操作は「新しいGPSランをGarmin Connectに同期してください」で足りる。受信されなければ配信先・通知状態・関数ログを調べる。

## 7. 仕様資料と限界

- ユーザー提供：`C:/Users/a-ebara/Downloads/Activity_API 2.0_0.pdf`（2.0、2026-10-15版）。次の環境ではファイルが存在するか確認する。
- SHA-256：`e7d88431d0876cbab7a6ea5773471570347e4dac69562f88a046a805e7063319`。
- PDFの5–6ページでPush、13–16ページでActivity Detailsを確認。PDF自体はGitへ追加していない。
- 権限変更通知本文はこのPDFに定義されていない。公式OAuth資料の権限GET・登録DELETEを併用した。
- Starter向けのみ。EnterpriseのPull・backfillは使わない。24時間超やGPSなし活動は今回の対象外。
- Garminが永久破棄した通知をStarterで復元できるとは説明しない。保守時のOn Holdは最大7日。エンドポイント無効化は待機通知を破棄するため注意。
- 以前のChatGPT会話参照は本文が参照記号のみで添付も取得できなかった。再参照するより、この書類、ROADMAP、実コード、再添付されたPDFを基準に進める。

## 8. 主要ファイル

| ファイル | 役割 |
|---|---|
| `supabase/functions/garmin-activity-push/index.ts` | Push受信、最小限のデータ保持、権限照会、トークン更新、再試行 |
| `supabase/functions/garmin-oauth/index.ts` | 接続、状態確認、解除、接続世代の更新 |
| `supabase/garmin-activity-inbox.sql` | 初期Inbox・RLS・Garmin外部IDの一意制約 |
| `supabase/garmin-activity-reliability.sql` | 接続世代、原子的保存RPC、待機データ取消、専用Vault認証、cron |
| `scripts/test-garmin-push.mjs` | Push・権限・障害・解除復旧のモック |
| `scripts/test-garmin-oauth.mjs` | 既存OAuthと解除障害時のモック |
| `scripts/test-garmin-controls.mjs` | 既存接続画面のモック |
| `scripts/test-garmin-database.sql` | ROLLBACK前提のDB統合テスト |
| `GARMIN-ACTIVITY-PUSH.md` / `ROADMAP.md` | 詳細設計・運用と進捗 |

実機確認前のためUIの「自動取り込み準備中」表示は維持し、UI Build番号は変更していない。
