# Garmin: 3経路（手動解除・OAuth callback・Push worker）隔離競合テスト

日付: 2026-11-13。対象: Draft PR #67（本番適用なし）。

## 目的と試験方法
- `supabase/tests/garmin_consent_three_actor_race_ci.sh` を新設。
- GitHub ActionsのPostgreSQL 16サービス `garmin_probe_ci` だけに接続し、`consent_ci.lifecycle`の合成UUID行を使って**独立した3つのpsqlバックエンドを競合**させる。
- 手動disconnectとcallback、workerは合成SQLの `consent_ci.apply` を共有し、`SELECT ... FOR UPDATE`による同一ownerの逐次化をモデル化。
- ケースA: 手動disconnectが先に行ロックを得る。callbackは待って新同意をpendingにし、workerは旧世代のremote revokeに入る。importはfalse。
- ケースB: callbackが先に新世代を確定し、古い手動disconnectとworkerは世代条件でfalse。新接続のimportを維持。
- ケースC: 旧世代remote DELETEの結果不明（`revoke_unknown`）。callbackはpendingのみ、workerによる旧世代retryは成立するが新世代の`revoke_confirmed`は拒否。旧世代がconfirmedになってもpendingを自動有効化せず破棄。
- 各ケースで別ownerの状態を維持。

## CI結果
GitHub Actions `43347880881` の新規 `Race manual disconnect OAuth callback and Push worker in PostgreSQL` と既存検査は**completed / success**。

## 独立監査と制限
- むせの2026-11-13独立監査はPR #67の前ヘッド`839dd58`について「隔離範囲で条件付き合格・本番No-Go」。現ヘッドの新規スクリプトと前工程のOAuth回帰テスト修復について**むせの追加判定は未確認**。
- これは3つの**合成DBクライアント**が同じ遷移関数を使用することの試験。実 `garmin-oauth` Edge Functionのcallbackと`garmin-activity-push` workerが共通トランザクションや同一owner leaseを使っている事実を証明しない。旧Garminアクセストークンのremote DELETEに伴う新同意への作用はGarmin回答未取得。
- `pg_sleep`を使った制御順序のテストであって、あらゆるスケジュール、lease喪失、タイムアウト、トークンローテーションや実ロールを網羅するものではない。
- 本番OAuth初回user_idのみの停止PATCHリスクは**依然現存**。本番DB・Edge・receiver・年輪は変更0。マージNo-Go、PR #67 Draft、PR #68 HOLD。
