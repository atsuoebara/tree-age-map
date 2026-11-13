# Garmin同意管理：owner lease期限切れ・中断・再試行の隔離検証

監査用資料（2026-11-13）／**本番未適用・PR #67 Draft・#68 HOLD**

## 検証対象
- `supabase/tests/garmin_consent_lease_recovery_setup.sql`：CI専用 `consent_lease_ci.owner_state`、owner UUID + connection generation + phase、lease_token、attempt_id、lease_deadline、pending_generationを持つ検証模型。
- `supabase/tests/garmin_consent_lease_recovery_ci.sh`：PostgreSQL16の独立した2クライアントで、claim競合、先行トランザクションのROLLBACK、leaseの期限切れ、古いworkerの完了遅延、新しいOAuth同意の保留と旧世代拒否を検査。
- `.github/workflows/garmin-shape-one-shot-postgres.yml`：隔離DBだけで実行。シェル側は `PGHOST=127.0.0.1` `PGDATABASE=garmin_probe_ci` 以外のDB接続を拒否。合成UUIDのみ。

## ルールと試験の意味
1. `disconnect` は同世代に限ってimportを無効化し、`disconnect_requested`になる。
2. `claim` は `disconnect_requested` だけで許可。owner行の条件付きUPDATEは2つのworkerで排他的。旧世代や2番目のclaimは拒否。
3. **claim前の処理中断**：未コミットのclaimはROLLBACK。後続workerのclaimは成功できる。この段階はまだ外部APIを送っていないという契約が必須。
4. **claimコミット後の中断**：遠隔DELETEが既に送信された可能性があるため、deadline満了時は `revoke_unknown`へ遷移、lease/attemptを破棄。remote成功とはみなさず、import停止・pending新同意の保留を維持。
5. `revoke_unknown`からの**自動再claimは禁止**。たとえ古いworkerが期限切れ後に`complete`を呼んでも、token+attempt+generationと有効期限の不一致により拒否。
6. 接続世代変更後の古いworker操作は拒否。他ownerは不変。
7. `revoke_unknown`からの再試行/解消は**公式GarminのDELETE応答の意味論・旧TOKENの作用範囲・タイムアウトの効果**を確認した後、監査済みの明示的な回復手順でしか開始できない（隔離モデルでは未実装）。

## CI証拠
GitHub Actions `43349776381`：新設 `Verify owner lease crash expiry UNKNOWN and safe claims` がsuccess。その他隔離PostgreSQL検証も成功。（ワークフロー全体の結論はJob検証に従う）

## 必ず注意する限界
- 新規テーブル・関数は`consent_lease_ci`の隔離模型のみ。**現行の`garmin_worker_lease`、OAuth callback、`garmin-activity-push`には接続していない**。本番のtimeout・retryを修正した証拠にはならない。
- モデルの`expire(..., p_now)`はCIで時間を注入するためのテストフック。**そのまま本番へ移植すると、呼出者が未来の時刻を渡して早期に失効させられる**。実運用ではDBサーバー時刻のみ、厳格なロール/実行権限が必要。
- 有効期限による旧workerのローカルcommit拒否は、旧workerの**HTTP送信取消を保証しない**。実Garmin DELETEの効果・二重送信・請求/無料枠は未検証。
- 本番に新規DB書込を実施していないため実Supabaseロール、RLS、既存トリガ、concurrent workerのプロセスクラッシュ、外部APIをまたいだ分散排他は未証明。
- 前段の純粋な状態遷移モデルには`retry_revoke`の許容ルールが残っているが、**本検証ではGarmin公式回答前の無条件・自動再送は不許可**。本番統合設計で両者を整理する必要がある。
- 既存ラン・年輪・Strava・Push ACKの非干渉、無料枠、プライバシー、安全な本人同意は本番変更前の独立監査が必要。

## 次の監査ゲート
**むせの独立監査**で①claimコミット前後のクラッシュ区別②remote結果不明とlocal lock期限を混同しない③旧worker commit拒否④期限パラメータの本番禁止⑤再試行の設計ルールを確認。Garminへの質問送信はAtsuoの明示承認があるまで行わない。**本番No-Go**。
