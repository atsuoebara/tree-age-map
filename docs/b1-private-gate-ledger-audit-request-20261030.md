# B-1 次工程：非公開の門番・公開台帳 監査依頼（2026-10-30）
## スコープと現状
- 実装候補SQL：`docs/b1-production-private-gate-and-ledger-v01-20261030.sql`（最終コミット `7c75cbe`）
- **GitHub上のSQL実装案まで。Supabase本番DBには未適用。Edge Function・公開ページ・正式同意UIは未実装。一般公開・同意受付ともOFF。**
- 既存本番スキーマ（`rr_private.region_rings_refresh_state`, `region_rings_public_authorization`, `region_rings_public_candidate`）はメタデータのみ読み取り、ユーザー行を参照していない。
- 新規作成案：公開OFFが初期値の `region_rings_publication_state`、国×確定年の一回承認スナップショット `region_rings_approved_year`、非公開の追記専用 `region_rings_publication_ledger`。
- 非公開の読み取り関数 `rr_private.b1_read_approved_year` は新旧両ゲートを共有ロックで照合。停止関数 `rr_private.b1_private_stop` は失効・世代増加を原子的に処理し、停止監査行を追加。
- 公開スキーマにRPCを作らず、`anon`/`authenticated`/`PUBLIC`の直接EXECUTE/テーブル権限を削除。最終公開APIは別工程。

## 監査対象・既知の未完了事項
1. 構文/権限/RLS/行ロック/例外トランザクション/イベント監査の安全性と、本番の既存失効トリガーとの整合。
2. 旧 `region_rings_refresh_state` の `publication_enabled` と新状態の二重OFFゲートの操作手順。新旧ゲートのどちらか片方が止まれば空応答。
3. 読取で同意者の個別状態を直接検査していない。**その代わり、公開承認前の合成/実データ処理とその世代・撤回連動が未実装**。本仕様をもって正式同意/匿名性審査を済ませたとみなさない。
4. `b1_private_stop` の監査記録はグローバル停止イベント（国='--', 年=0）。公開セル単位の開始・承認・停止日時の完全な履歴は、承認ワークフローと合わせて追加予定。台帳の追記専用トリガーがエラー/ロールバックと正しく連動するか要試験。
5. 一度承認されたスナップショットの値・世代変更はトリガーが拒否。旧セルの更新・取消しは `approved` フラグ等の制御のみ。**厳格な不可逆抑制、再承認時の差分攻撃防止は未完成**。
6. テーブル・関数の作成は`IF NOT EXISTS`/OR REPLACEでも、繰り返し適用と既存定義に互換性がある保証はない。**本番に直接流す前に隔離PostgreSQLで構文と権限を試験すること**。
7. Edge Function経由のアクセス権限、HTTP no-store、撤回前後の配送競合、年締めの確定、攻撃テストT1〜T9と匿名性閾値、正式同意画面は引き続き未実装・未承認。

## 求める判定
- このSQLを隔離環境で試験する前提として設計上妥当か。先に修正すべきP0項目を列挙。
- 本番環境の変更・一般公開・正式同意受付は**まだ許可しない**。実装差分の監査のみでよい。
