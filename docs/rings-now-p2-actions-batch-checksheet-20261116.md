# Rings Now P2 — GitHub Actions専用 実行前・実行時チェックシート v0.1
作成：2026-11-16。状態：**設計文書のみ／全項目NOT RUN／P2実行未承認**。

## 適用範囲・優先順位
- PC負担を避ける代替経路の**候補B**。既存 `docs/rings-now-p2-a1-a6-batch-checksheet-20261116.md`（#162）のPC経路を上書きしない。
- 基本方針：`docs/rings-now-p2-actions-feasibility-cost-gate-20261116.md`（#163、追補79/80監査済み）を参照。現行PG17合成CIは実Auth・PostgRESTの証拠にならない。
- **このチェックシートのPR作成・マージは、workflow追加/変更・Actions起動・P2実行・SQL適用の承認ではない。**
- 本番OFF、`featureStartedAtMs=null`、PR #109 HOLDを維持。実SupabaseへのSQL、実Auth接続、実HTTP、実FIT、本番ON、外部有料サービスは禁止（別途明示承認まで）。

## Gate A：開始前（全項目の証拠とむせ実行前監査、本人の実行承認が必須）
| ID | 確認事項・必要な証拠 | 状態 |
|---|---|---|
| GA-01 | Atsuoが**GitHub Actions経路でのP2実行**の範囲・ジョブ数・上限を明示承認 | NOT APPROVED |
| GA-02 | Actionsの実際の課金画面・標準runner・public repo・使用量/保存枠・請求設定を照合し、追加費用0円を実証。推測や一般原則だけでは不可 | TBD |
| GA-03 | 使用するworkflowのHEAD SHA、全依存とイメージの固定、既存CIとの差分、実行トリガー、実行権限を確認 | TBD |
| GA-04 | 本番のURL・JWT・APIキー・DB接続文字列・実ユーザー情報を一切使わない隔離を静的/実行前に確認。Secretsへのアクセス、外部ネットワーク経路を洗い出す | TBD |
| GA-05 | 一時Supabase Auth + PostgREST + PostgreSQLの起動・本物のローカルJWT（失効を含む）検証が可能な構成を設計し、バージョン固定・必要リソース・停止条件を確認 | TBD |
| GA-06 | 候補SQL原本 `docs/rings-now-single-statement-snapshot-CANDIDATE.sql` のSHA/バイト照合、合成fixture、権限/ロール/RLSの事前状態保存 | TBD |
| GA-07 | A1〜A6のテスト計画、ロール切替・同時更新・境界・性能の閾値/停止条件を実行前に固定 | TBD |
| GA-08 | 成果物・ログ・artifactの保持と秘匿、実行時間・同時実行数・使用量上限、cleanupと異常停止を確認 | TBD |
| GA-09 | むせによる**実行対象HEADの実行前監査**に合格（文書監査だけでは代替不可） | NOT AUDITED |
| GA-10 | mainの本番OFF、開始時刻null、#109 HOLD、既存機能への無変更を実行直前に確認 | TBD |

**ひとつでも未達なら実行しない。** 公開リポジトリ+標準ランナーの一般的な無料原則だけでGA-02をPASSにしない。runnerが自動的にlarger runner等へ切り替わる構成は禁止。クラウド/PC経路への自動フォールバック禁止。

## Gate B：一括実行の順序（全てNOT RUN、実行前にログ時刻をJSTで記録）
| 順 | 目的 | 必須ログ・証拠 | 状態 |
|---|---|---|---|
| B-01 | HEAD・料金・隔離・実行対象確認 | SHA、runner、billing確認時刻、接続先の**非機密識別子**、停止条件 | NOT RUN |
| B-02 | 一時環境の構築 | image/CLI digest、起動ヘルス、localhost endpoint、production接続なし | NOT RUN |
| B-03 | 合成fixtureと原本SQL適用 | 原本ハッシュ、before/after ACL、owner/継承/BYPASSRLS、ロール | NOT RUN |
| B-04 | A1 実Auth/JWT/HTTP/ACL/RLS | 匿名・本人・他人・失効JWT・ユーザー切替、実PostgREST RPC、#153 parser、ownerScoped非信用 | NOT RUN |
| B-05 | A2 一貫性 | 並行INSERT/UPDATE/DELETE、ABA、同件数入替、古い応答破棄（別系統） | NOT RUN |
| B-06 | A3 境界 | 0/1000/1001、NULL、too_many_rows優先、6列、6桁小数秒、8日境界 | NOT RUN |
| B-07 | A4/A5 性能・費用 | 事前合意した負荷上限内の計測、実際の消費量、料金証拠。**本番Micro性能を保証しない** | NOT RUN |
| B-08 | A6 復旧・破棄 | 中断・異常ACL・cleanup、再実行時の状態、証拠の整合 | NOT RUN |
| B-09 | 総合照合 | PASS/FAIL/NOT PROVENを分け、未証明は合格にしない。むせ事後監査へ | NOT RUN |

## Gate C：自動停止・fail-closed
- 本番URL/キー/Secrets/実データが見つかった、接続先がlocalhostでない、権限が想定外、ハッシュ不一致、失効JWTが通る、他人のデータが見える、1001件を受け付ける、必要な実サービスが起動しない場合は停止。
- GitHub Actionsの利用枠や請求条件が不明、無料の根拠が失われた、リソース/時間上限超過、ログに秘密情報が出るおそれがある場合も停止。
- 停止した場合、未実施項目をPASSにしない。原因を記録し、再実行は新たな承認が必要。
- 成功しても本番SQL適用・P3・本番ON・実FITへの進行を自動化しない。

## Gate D：監査・承認記録欄
- 実行対象HEAD：**未確定**
- workflow/fixture/依存のSHA：**未確定**
- 費用0円の証拠（公式請求画面と日時）：**未確認**
- むせ実行前監査：**未実施**
- AtsuoのP2実行承認：**なし**
- 実行時刻（JST）：**なし**
- A1〜A6：**全てNOT RUN**
- 事後監査：**未実施**

## むせへの文書監査観点
- #162を無断上書きしていないか、#163のE1〜E7とA1〜A6を網羅しているか。
- 本物のローカルAuth/PostgRESTと既存の合成PG17 CIを混同していないか。
- 料金・隔離・失効JWT・権限・同時更新・6桁精度・8日境界・復旧・停止・ログ・実行前後の承認がfail-closedか。
- **この文書監査ではworkflowを実行せず、P2実行承認とみなさないこと。**
