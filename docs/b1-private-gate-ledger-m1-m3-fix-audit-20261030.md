# B-1 本番用非公開ゲート・公開台帳：M1〜M3修正報告／次回独立監査資料
2026-10-30。対象はレビュー用SQLと隔離試験のみ。**本番Supabaseには未適用。**

## 前回むせ監査への対応
- **M1: 修正済み（コード）**。旧 `rr_private.region_rings_refresh_state.publication_enabled` は既存のfalse固定制約と矛盾するため、内部読取の公開権限判定から除去。新 `rr_private.region_rings_publication_state.publication_enabled` だけを公開可否の権限とし、旧側の `is_dirty` は失効検出として保持。旧側の `publication_enabled=false` が維持されても、有効・承認済みの合成セルを読み取れる隔離試験を追加。
- **M2: 修正済み（コード）**。公開台帳UPDATE/DELETEに加え、statement-level TRUNCATE triggerを追加。承認済みスナップショットのDELETEと全スナップショットTRUNCATEを拒否し、承認日・締切日の変更を禁止。承認済み→未承認の切替と永久抑制の解除も禁止（証跡消去を防ぐ）。停止時は `permanently_suppressed=true`。
- **M3: 修正済み（コード）**。台帳 action='approve'|'start' の場合は正のrounded_distance_kmをCHECKで必須化。stop/suppressではNULLを認める。隔離DBテストでNULLを拒否することを検査。
- 元のSQLファイルに差分修正：`docs/b1-production-private-gate-and-ledger-v01-20261030.sql`（ファイル名v01は継続、本文v0.2）。
- 隔離テスト：`docs/b1-private-gate-ledger-isolated.test.sql`。
- 自動実行：`.github/workflows/b1-private-gate-ledger-isolated.yml`（push＋手動、PostgreSQL16の使い捨てDB）。
- GitHubファイルの存在・M1〜M3の必須句について機械的な静的検査はPASS。**PostgreSQL実行ログおよびActionsのsuccessは現時点で未取得、隔離試験合格とは言わない。**

## 隔離自動テストの検査項目
1. 旧publication_enabled=falseのまま、新ゲートON・承認済みの合成年に正しい値が返る。
2. approved=falseへの書戻し、承認日・締切日変更、承認済みDELETE、スナップショットTRUNCATE、永久抑制解除が拒否される。
3. approve/start台帳行がNULLの値で登録できない。正の値は保存できる。
4. 台帳UPDATE/DELETE/TRUNCATEがすべて拒否される。
5. 旧is_dirtyで公開配信が閉じる。
6. 二度の停止は世代増加1回だけ。停止ログが追記され、値を返さない。
7. anon/authenticatedの読取関数実行・台帳SELECTを拒否。

## むせへの再監査依頼で見てほしい点
- M1〜M3の指摘が完全に閉じたか。新しく追加した承認済み不可逆・抑制不可逆・TRUNCATE対策が適切か。
- SQLの構文と隔離PGテストの精度、およびCIで実際に成功したか（実行結果へのアクセスが可能なら検証）。
- 実運用では旧dirtyを清掃する経路と新is_dirtyの管理を分離して設計する必要がある。とくに**正式同意の撤回・活動削除・既存失効トリガー・グローバル停止を同じ原子的処理に結ぶ操作は未実装**。
- 承認/配信開始関数はまだない。専用権限・承認履歴・審査済み値・再承認禁止・寄与者匿名性・year-closeの最終確定は未実装。
- 公開後HTTP撤回競合・Cache-Control・CDN/Service WorkerテストはAPI完成後の必須条件。

## 判定の境界
GitHubでSQL・テストを作成したところまで実装済み。**本番DBの移行、Edge APIの設置、同意受付、一般公開は一切していない**。公開OFFを維持。次は隔離PGの成功実ログ→むせがM1〜M3修正差分を確認→承認/配信開始の安全ワークフローを実装する。
