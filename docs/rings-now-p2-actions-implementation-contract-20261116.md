# Rings Now P2 — Actions実装契約・依存固定仕様 v0.1
2026-11-16。**設計文書のみ／NOT RUN／P2実行未承認**。#163（実現性）、#164（チェックシート）、#165（隔離スタック）を具体的な実装の受け入れ条件に落とす。PC経路#162と既存PG17合成CIは変更しない。

## 1. 実装の成果物（後続の別PRで作成、現PRでは未作成）
- 手動専用の隔離Actions workflow（`workflow_dispatch`のみ）。`pull_request`/`push`/`schedule`を**登録しない**。作成・マージ時に新P2ジョブが自動起動しないことを監査する。
- 独立したfixture SQL（架空ユーザー2人、他人の行、0/1000/1001件、NULL、6桁小数秒、8日境界）、HTTP/Auth/PostgRESTの試験クライアント、結果をPASS/FAIL/NOT PROVENに分離する出力。
- 隔離環境の起動/終了スクリプト、バージョン・digest・fixture/原本SQLのハッシュ台帳、cleanupの終了コード検査。
- 本番URL・鍵・ユーザーデータを参照しない。既存PG17 workflowをP2合格の根拠に流用しない。

## 2. バージョン固定の契約
| 対象 | 実装前の確定事項 | 現状 |
|---|---|---|
| Runner | 標準GitHub-hosted runner。可能ならOSイメージを明示固定し、実行ログで確認。larger runnerは禁止 | TBD |
| Checkout | `actions/checkout`のcommit SHA固定、取得元・権限確認 | TBD |
| PostgreSQL | major/minor、コンテナのsha256 digest、内部ロール/権限 | TBD |
| GoTrue | 正規配布元、実在タグ、sha256 digest、起動時必須環境変数、JWT署名方式 | TBD |
| PostgREST | 正規配布元、実在タグ、sha256 digest、GoTrue JWTとの互換性 | TBD |
| テストクライアント | ランタイムと依存をlockfile/commit SHAで固定。実HTTPの証拠を残す | TBD |

**実在しないタグや未確認のdigestを埋めて「固定済み」としない。** 実際のタグ/digestの照合が済むまでworkflow実装と実行は保留。イメージ更新は新HEADと再監査を要求。

## 3. 認証とDBの必須テスト契約
1. GoTrueの**実サインアップ/サインイン**で架空ユーザーA/Bを作成し、JWTの`sub`/`role`/`aud`/`exp`を検査。ログにJWTの全文を出さない。
2. PostgRESTがそのJWTを検証して、認証済みのRPCが成功、匿名・他人・失効JWTは適切に拒否または行不可視となることをHTTP応答で確認。失効は短命JWTの自然な期限切れで検証し、時刻改変や署名偽造はしない。
3. `auth.uid()`はPostgRESTのJWT claimsに結びつく実関数をfixtureに定義。PostgreSQLロールの`LOGIN`/`NOLOGIN`、継承、`BYPASSRLS`、schema usage、function execute、table GRANTをSQLで検査。合成fixtureのロールとSupabase本番との差異を記録。
4. 候補SQL原本 `docs/rings-now-single-statement-snapshot-CANDIDATE.sql` をバイト単位ハッシュ照合し、一時DBのみに適用。RPCの6列と#153パーサーを照合。
5. A2の同時INSERT/UPDATE/DELETE・ABA・同件数入替は、**単一トランザクションのスナップショット**とクライアントの古い応答破棄を別々に検証する。
6. A3の0/1000/1001件、NULL、too_many_rows優先、6桁小数秒、8日境界を固定期待値で検査。時計/タイムゾーンを明示する。
7. A4の実行時間はActions上の参考値であり、Supabase Pro Micro本番の性能保証としない。負荷の上限は事前承認を要する。

## 4. 隔離・課金・停止の実装契約
- 端末のPC/Dockerを使わない。実行時はGitHub Actions内の**一時環境だけ**を使用。
- workflowに`secrets.*`や本番`SUPABASE_URL`/`DATABASE_URL`参照を置かない。実行時に接続先を検査し、localhost/隔離内部以外へのAuth/RPC/DB接続を拒否。イメージpullの外向き通信は別に扱い、完全な外向き遮断を主張しない。
- 標準runner・単一ジョブ・時間上限・同時実行上限・artifact保存量/保持日数を明示。失敗時にもcleanupを実行し、cleanup失敗を失敗扱いにする。
- 実行前に**GitHub請求画面の利用状況・課金設定・保存条件を確認して追加費用0円の根拠を得る**。public repoであるだけでは0円確定としない。
- 本番OFF、開始時刻null、PR #109 HOLDを実行前後に確認。未確認はPASSにしない。

## 5. 別PRを作る際の受け入れゲート
- [ ] 実装HEAD・変更ファイル・triggerを確認（自動起動なし）
- [ ] 依存の実在タグ/digest/互換性とハッシュ台帳を確認
- [ ] ローカル実Auth/JWT/PostgRESTと合成PG17 CIを区別
- [ ] #164 GA-01〜GA-10の未達を残したまま**実行しない**
- [ ] むせが実行対象HEADを独立監査
- [ ] Atsuoが費用・範囲・実行回数を明示承認した後だけ、別操作で手動起動
- [ ] A1〜A6の結果は証拠があるものだけPASSとし、未証明はNOT PROVEN

## 6. 現在のステータス
設計文書の追加のみ。**workflow未作成、実サービス未起動、費用証拠未取得、実行未承認、A1〜A6全NOT RUN**。本番SQL/DB/実FIT/本番ONに変更なし。

## 7. むせ監査観点
このPRが新規文書1ファイルのみであること、#162〜#165の条件を緩めないこと、存在未確認の依存を固定済みと主張しないこと、実行トリガー・費用・認証・権限・cleanup・承認のfail-closedを確認。**文書監査はP2実行承認ではない**。
