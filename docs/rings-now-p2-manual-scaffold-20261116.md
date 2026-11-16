# Rings Now P2 — 手動隔離スタック・スキャフォールド（実行禁止）

このPRは実行可能なP2環境の完成ではない。workflowは `workflow_dispatch` のみで、唯一のjobに `if: ${{ false }}` を固定した **hard stop** を置く。ジョブは起動しない設計だが、手動dispatch自体も未承認。pull_request / push / schedule は登録しない。既存workflowは変更しない。

## 実装した範囲
- 手動専用workflowの無効化骨格。10分上限、標準ubuntu runner、contents:read、同時実行抑止
- 機械可読の未確定依存台帳。PostgreSQL/GoTrue/PostgRESTの実在digest・checkout SHAは未確認なのでnull。架空値で埋めない
- 本番SupabaseのURL、キー、Secrets、DB接続、外部通信、Docker起動、Auth起動、SQL適用、FIT読込は一切含めない

## 解除前の必須ゲート
1. 公式供給元と互換バージョン、実在するdigestを独立に検証し固定する
2. 実GoTrue JWTとPostgREST検証の互換性、RLS fixture、候補SQLバイト照合、認証・期限切れ・他人のデータ拒否・同時実行試験を別PRで実装
3. GitHub Actions請求画面で追加費用0円を確認（現状 NOT VERIFIED）
4. workflowのhard stop解除は別PR・むせ独立監査・Atsuo明示承認後のみ。解除だけではdispatch許可にならない
5. 実行直前に本番OFF、開始時刻null、PR #109 HOLDを確認し、実行回数と範囲を個別承認
6. 実行後のcleanupと課金確認、A1〜A6のPASS/FAIL/NOT PROVENを別途記録

**現在：実スタック未構築、P2全項目NOT RUN。Actions実行・本番変更は承認されていない。**
