# Rings Now P2 — Actions隔離スタック設計 v0.1（実行禁止）
2026-11-16。**文書のみ／NOT RUN／P2未承認**。前提：PR #163・#164（追補79〜81合格）。PC経路#162と現行PG17合成CIは変更しない。

## 目的と到達点
GitHub-hosted standard runnerの**一時的な隔離環境**に、PostgreSQL、GoTrue（Supabase Auth）、PostgRESTを立ち上げ、合成ユーザー・合成記録だけで実HTTP/JWT/RLSの挙動を確認する候補を具体化する。**Supabase本番と完全同一ではない**。実サービス起動が未検証なので、この設計自体をP2合格や追加費用0円の証拠としない。

## 構成候補と境界
1. 実行基盤：GitHub Actionsのpublic repo・標準 `ubuntu-latest`、一時ジョブ、`permissions: contents: read`、単一ジョブ・同時実行制限・timeout上限。workflowは**未作成**、起動もしない。PRイベント自動起動を避け、将来の実行承認後も手動起動を候補とする。
2. DB：一時PostgreSQL（バージョン固定、合成専用DB、非本番資格情報）。`auth`/ `public` schema、`auth.uid()`、`authenticated`/`anon`などの必要な実ロール・GRANT・RLSを**fixtureで明示**。模擬ロールがSupabaseホスト環境と同一とはみなさず差異を記録。
3. Auth：ローカルGoTrue（タグではなく不変digest固定を候補）、合成メール・合成パスワードで2ユーザーを作成し、**実際に発行されたJWT**を取得。期限切れJWTの検証手順は、テスト専用の短い有効期間で発行する方法を事前確定し、署名や時刻改変による偽陽性を避ける。期限切れを実HTTPで拒否することを確認。
4. API：ローカルPostgREST（digest固定候補）、JWT検証、匿名/認証ロール切替、RPCをHTTPで呼ぶ。GoTrueのJWT署名方式・aud/role/sub/expとPostgRESTの設定の互換性を**実行前に設計検証**。AuthのHTTP成功だけではRLS合格にしない。
5. 接続：各サービスはジョブ内のlocalhost/内部コンテナネットワークに限定し、**本番Supabase URL・本番キー・実ユーザー情報・GitHub Secretsを持ち込まない**。GitHub-hosted runnerの外向き通信を単に「禁止できた」と推定しない。イメージpull等の外部通信とAPI通信を区別し、接続先を検査する。完全なネットワーク遮断を要求する場合はその実現性を別途確認。
6. SQL：原本 `docs/rings-now-single-statement-snapshot-CANDIDATE.sql` の実バイト/SHA256を実行前に照合し、一時DBにのみ適用。合成fixtureのスキーマ・権限・行数を事前固定。**本番DBへの適用はしない**。
7. テストクライアント：HTTPで認証→RPC、認証なし、他人、期限切れ、ユーザー切替を確認し、返却6列を既存#153パーサーへ接続。テストコードのownerScopedなど自己申告を認可根拠にしない。

## 実装前の未解決項目（TBDをPASSにしない）
| ID | 必須確定事項 | 状態 |
|---|---|---|
| S-01 | GoTrue/PostgREST/PostgreSQLの互換バージョン、digest、公式イメージ供給元、ライセンス・pull制限 | TBD |
| S-02 | Authのユーザー作成/サインイン、JWT発行・期限切れ生成、実PostgRESTのJWT検証設定 | TBD |
| S-03 | DBロール、`auth.uid()`、schema権限、RLS、owner/継承/BYPASSRLSの忠実度と差異 | TBD |
| S-04 | サービス起動・ヘルスチェック・localhost固定・実行者権限・秘密流出防止 | TBD |
| S-05 | 並行INSERT/UPDATE/DELETE、ABA・同件数入替、1000/1001、NULL、6桁秒、8日境界のfixtureと期待値 | TBD |
| S-06 | Actionsランナー資源・実行時間・アーティファクト保持・ログ量・cleanup、fail-closed | TBD |
| S-07 | **GitHub請求画面での追加費用0円証拠**、保存/使用量/課金設定。public+standard runnerの一般原則では代替不可 | TBD |
| S-08 | 実行workflow/fixture/依存を別PRに固定し、むせ実行前監査とAtsuoの明示的P2実行承認 | NOT APPROVED |

## 段階ゲート（全てNOT RUN）
- **D0 設計レビュー**：この文書の監査。workflowも実サービスも起動しない。
- **D1 静的実装**：S-01〜S-06を具体化したworkflow・fixture・テストを別PRで作成。作成時にPRが自動で実行される構成は禁止。既存workflowを流用してP2実証と称さない。
- **D2 費用・実行前承認**：#164 GA-01〜GA-10を全て満たし、むせが実行対象HEADを監査、Atsuoが実行を明示承認。料金未確認なら停止。
- **D3 一時実行**：#164 B-01〜B-09の順。A1〜A6をPASS/FAIL/NOT PROVENで別記し、JSTの実行時刻、依存digest、結果、失敗時のcleanupを残す。
- **D4 事後監査**：実行ログ・請求状況・隔離・本番OFF/null/#109 HOLDを確認。P2の結果が良くてもP3、実SQL、本番ONへ自動進行しない。

## 想定停止条件
本番URL/キー/Secretsの参照、予期しない外部接続、JWT失効不成立、他人のデータ露出、1001件の誤受理、権限不一致、イメージdigest不一致、利用料金不明/追加費用発生のおそれ、タイムアウト、cleanup失敗で即停止。再実行は新たな承認が必要。

## むせへの監査観点
文書1ファイルのみか、#162〜#164と矛盾しないか、ローカルの**本物のAuth/JWT/PostgREST**とPG17合成CIの差を保っているか、未解決をTBDのまま扱っているか、追加費用0円・本番隔離・実行前後の承認を誇張していないか。**文書監査のみ、マージも実行も未承認**。
