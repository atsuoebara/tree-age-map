# Rings Now P2 — GitHub ActionsによるPC不要代替案の実現性・費用ゲート v0.1
作成日：2026-11-16。**調査設計のみ／NOT RUN／P2未承認**。根拠：PR #157、#160、#161、#162と既存 `.github/workflows/rings-now-pg17-isolated-candidate.yml`、`docs/rings-now-pg17-isolated-test-20261115.md`。

## 0. 方針と承認境界
- AtsuoのPCは古く原則利用できない。DockerのPCへの導入を前提にしない。
- 既存GitHub Actionsの隔離PostgreSQL 17は**合成SQL/ACLの模擬検証のみ**。Supabase Auth・失効JWT・PostgREST・実RLS・本番性能を証明しない。
- **本書の作成・監査・マージはP2実行承認ではない**。workflowの追加・変更・実行、Actions課金、外部サービスへの接続、SQL適用、DB変更、本番ON、実FIT取込は未承認。
- 本番入口OFF・開始時刻null・PR #109 HOLDを維持。P2合格でもP3と本番SQL適用は別承認。

## 1. 既存の確認済み事実
- 既存workflowは `ubuntu-latest`、`postgres:17`、`timeout-minutes: 10`、`contents: read`、合成DB `rings_now_synthetic` を使用する。
- `SUPABASE_URL` と `DATABASE_URL` が空であること、PGHOST localhost、架空の資格情報、PG17を確認してからSQLを実行する。
- 原本候補SQLを一時コンテナに読み込み、模擬 `auth.uid()`、RLS、ロール、ACLを検証する。**実Supabase Auth/PostgRESTは起動していない**。
- Actions利用枠は消費され得る。無料枠残量・請求上限・実行時点の料金は**未確認**。

## 2. PC不要のP2代替として必要な追加設計（すべて未実施）
| 項目 | 事前に決めること | 状態 |
|---|---|---|
| E1 実環境忠実度 | Supabase CLI相当のAuth・PostgREST・DB・JWTの構成、バージョン固定、起動手順、実JWTと失効JWTをローカル生成する方法 | TBD |
| E2 隔離 | 本番URL・本番キー・外部接続・実ユーザーデータを持ち込まない証拠、GitHub Secretsと環境変数の扱い、ネットワーク経路 | TBD |
| E3 コスト | リポジトリ公開/非公開、Actionsの無料枠残量・課金設定・ランナー種別・見積りと上限を公式画面で確認。**0円の根拠が取れなければ実行禁止** | TBD |
| E4 再現性 | コンテナイメージ・CLI・依存の固定、ハッシュ照合、合成fixture、実行前監査、結果の保全 | TBD |
| E5 制限 | 1回あたり時間・CPU/RAM・ジョブ数・同時実行・停止条件、ログへの秘密流出対策 | TBD |
| E6 復旧 | 一時環境の破棄・再実行時の状態・途中失敗時の後片付けと再承認 | TBD |
| E7 証拠 | A1〜A6のうち何を実証でき、何が模擬のままかを区別。実RPC出力→#153パーサー、ownerScoped自己申告を信用しない証拠 | TBD |

## 3. A1〜A6との対応（すべてNOT RUN）
- **A1 権限**：実Auth/JWT（失効・ユーザー切替含む）、PostgREST、ACL、RLS、owner/継承/BYPASSRLS。単なるセッション変数模擬ではPASSにしない。
- **A2 一貫性**：同時INSERT/UPDATE/DELETE、ABA・同件数入替、遅延応答破棄を別証拠として検証。
- **A3 境界**：0/1000/1001、NULL、too_many_rows優先、6列、小数秒6桁、8日境界、実RPC出力→#153パーサー。
- **A4 性能**：測定方式・負荷上限・中止条件を事前確定。Actions上の測定は本番Microの性能証明ではない。
- **A5 費用**：**P2追加実行分**の0円根拠が取れなければ保留。既存Supabase Pro料金の再審査はしない。
- **A6 復旧**：失敗・切断・ACL異常、cleanup、再実行と再承認を検証。

## 4. 比較判断
| 案 | PC利用 | 長所 | 未解決の問題 | 現時点 |
|---|---|---|---|---|
| A 既存PG17合成CIを維持 | 不要 | 既存の安全策と実績 | P2の実Auth/PostgRESTを証明しない | 既存成果のみ |
| B GitHub Actions内でローカルSupabaseスタック | 不要 | P2の必要な実Auth/PostgRESTに近づく可能性 | 実現性・起動負荷・利用枠・費用・秘密・再現性が未確認 | **第一候補、設計調査のみ** |
| C 古いPCにDocker導入 | 必要 | ローカル検証 | PC負担大、環境不明 | 原則採用しない |
| D 新規クラウド/本番代用 | 不要 | なし（現要件下） | 追加費用・本番影響・承認境界 | 採用しない |

## 5. 次の承認ゲート
1. まず**GitHubの料金・Actions利用条件を読み取りだけで確認**し、E1〜E7の実行可能性を設計する。費用の推測で「無料」と断定しない。
2. 具体的なworkflow・fixture・ログ・停止条件を別PRで作成し、むせに**実行前監査**を依頼する。PR作成/マージとworkflow実行は分けて承認を得る。
3. **Atsuoが対象・費用・実行範囲を明示承認するまではP2を開始しない**。PCが使えなくても無断で代替環境を起動しない。

## 6. むせへの文書監査依頼
既存PG17 CIの証明範囲、実Auth/PostgREST未証明、E1〜E7、A1〜A6、追加費用0円の未確定表示、PC非依存、本番非接続・本番OFF・PR #109 HOLDの整合を確認。**文書だけを監査し、workflowを実行しないこと。**

## 7. 2026-11-16 読み取り調査追補（追補79の文書監査後）
- GitHub repository metadata API の `visibility` は **public**、既定ブランチ `main`。これはリポジトリ公開設定の直接確認であり、請求画面の確認ではない。
- 現行の `rings-now-pg17-isolated-candidate.yml` は `runs-on: ubuntu-latest`（GitHub-hosted standard runner）、`timeout-minutes: 10`、PostgreSQL 17サービスを使用。
- GitHub公式ドキュメントは、公開リポジトリの標準GitHub-hosted runnerのActions利用を無料と案内している。ただし、この原則を**将来のP2追加ワークフロー全体の無条件0円保証と取り違えない**。GitHub-hosted larger runner、外部サービス、アーティファクト保存・保持、依存イメージ等の利用条件は個別確認する。
- 現在のGitHub請求画面、Actions使用状況、保存容量、課金設定はこのコネクタでは**未確認**。実行時の料金設定を確認するゲート E3 は **TBDのまま**。
- **今回の調査ではActions実行・workflow追加・SQL適用・DB変更・本番ONは一切していない**。今後のActions版チェックシートは#162のPC版を無断置換せず別PRで設計する。
- 参照: https://docs.github.com/en/actions/concepts/billing-and-usage 、https://docs.github.com/en/billing/concepts/product-billing/github-actions 。
