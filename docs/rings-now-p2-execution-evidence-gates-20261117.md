# Rings Now P2 — 実行前の証拠・承認ゲート（2026-11-17）

**Status: BLOCKED / NOT RUN.** 本文はチェックリストの整理だけ。Actions dispatch、Docker pull、GoTrue、PostgREST、DB、SQL実行、prod変更、本番ON、実FIT取込を含まない。別の暗黙承認は成立しない。

## 監査済み成果物と今回の境界

- PR #177（静的manifest/workflow構文検査）、PR #178（合成10シナリオと応答比較器）は独立監査・mainマージ済み。これらのテストPASSを**P2実環境の合格と取り違えない**。
- 実行停止の主条件は `.github/workflows/rings-now-p2-isolated-manual.yml` のジョブレベル `if: ${{ false }}`、manifest `tests/rings-now-p2-isolated-manifest.json` の `status=BLOCKED_NOT_RUN`, `explicitExecutionApproval=false`。本書ではどちらも変更しない。
- 実行対象として設計済みの候補SQLは `docs/rings-now-single-statement-snapshot-CANDIDATE.sql`。**実Supabase本番への適用は承認されていない**。本番OFF・開始時刻null・PR #109 HOLDを維持。

## 未解決ゲートと「何を証拠とするか」

| ID | 実行前に必要なもの | 今の事実 | 実証方法・受け入れ記録 |
|---|---|---|---|
| G1 | PostgreSQL / GoTrue / PostgRESTの公式参照とlinux/amd64不変digest | タグ候補のみ。digest null | 公式配布元、実タグ、digest、確認日・出典を台帳に記録。タグのみでPASS不可 |
| G2 | GitHub Actions費用が追加0円である根拠 | **一部確認済み・実行費用は未証明**：2026-11-17本人提示のBilling画面で当月Actions請求額$0、Actions予算$0、予算一覧に`Usage blocked`を確認 | 現在の請求・予算表示は証拠として記録済み。ただし実行時のstandard runner固定、artifact/ストレージ課金、実行前後の請求・停止条件は未検証。将来費用0円の保証として扱わず、残る確認が取れなければSTOP |
| G3 | 一時実行環境の固定と外部接続制限 | NOT RUN | 単一standard runner、checkout SHA、タイムアウト、ログ/保持日数、cleanup、認証/RPC接続先loopback検査を静的監査。外向きimage pullとAPI通信を区別 |
| G4 | 実行対象HEADの独立監査 | P2実行対象は未監査 | Workflow/manifest/fixture/runner/依存参照をむせが**実行対象の正確なHEAD**で監査。PR #177/#178の監査で代替不可 |
| G5 | AtsuoによるP2実行の個別承認 | NOT APPROVED | 範囲・費用・回数・実行者・安全停止/cleanupを提示して明示承認。単なる「ネクスト」「おけ」やPRマージでは代替不可 |

**実行前ゲートG1–G5と、実行後のHTTP/JWT観測証拠は別物。** 実Authがまだ起動していない時点で `PROVEN_BY_ISOLATED_HTTP` を求めると循環するため、実行前には求めない。

## 実行後（未着手・NOT PROVEN）の証拠

| ID | 実観測が必要な内容 | 状態 |
|---|---|---|
| H1 | GoTrueで架空ユーザー2人の実signup/signin、実JWTのsub/role/aud/exp、署名・期限切れ検証 | NOT PROVEN |
| H2 | PostgREST実HTTPで正しい認証/匿名/他人/失効JWTとACL・RLS。未認証の結果は `http_auth_rejected` と `rpc_blocked` を区別して記録 | NOT PROVEN |
| H3 | PostgREST v14系と `auth.uid()` / JWT GUCの互換性。単独 `request.jwt.claim.sub` GUCの有無を実HTTPで観測。未設定でNULL/0行なら不具合をPASS扱いしない | NOT PROVEN |
| H4 | 候補SQL原本ハッシュ照合と一時DB適用、0/1000/1001、NULL優先順位、他人・削除行、6桁精度・8日境界 | NOT PROVEN |
| H5 | 並行更新/削除/ABA/同件数入替と単一スナップショット、ログアウト後の古いレスポンス破棄は別々に検証 | NOT PROVEN |
| H6 | 正しい環境での後片付け完了・課金事後確認・本番OFF/null/#109 HOLDの不変確認 | NOT PROVEN |

- 実行できたこと自体をH1–H6のPASSにしない。未観測は必ずNOT PROVEN。
- JWT全文・パスワード・実ユーザー情報をログに残さない。証拠の原本/時刻/HEAD/digest/出所、失敗時の止め方を記録する。
- P2合格でもP3・本番ON・実FIT・本番SQL適用の承認にはならない。


## G3 隔離環境・停止・後片付けの実装契約（設計確定前／NOT RUN）

**この節は将来の実装に対する受け入れ条件であり、現在のworkflowへ実装済みという意味ではない。** `if: ${{ false }}` を解除する案・実行手順を提供するものではない。

### 実行境界

1. GitHub-hosted **standard** Linux runner、手動トリガー1件、P2専用1ジョブ、明示timeout・concurrency制限。追加ジョブ、自動トリガー、larger runnerへの変更は再監査。runnerのOSと実行対象HEAD・checkout action commit SHAを実行記録に固定する。
2. PostgreSQL / GoTrue / PostgRESTを**同じ使い捨てジョブ内**に限定し、合成ユーザー・合成データのみを使用する。永続Volume、外部DB、本番Supabase接続・実個人データ・production資格情報を禁止。非本番の一時的な署名秘密値もログ出力しない。
3. ローカルHTTPクライアントは `127.0.0.1` / `::1` にソケット接続を固定。URLに資格情報・query・fragmentがあれば拒否。リダイレクト、プロキシ、DNSによる転送、想定外RPCパスを拒否。IPv4/IPv6のループバック混同を避け、実際の接続先を証拠に残す。コンテナ内部ネットワークやレジストリpullまで完全遮断できたと誤認しない。
4. 起動前に候補SQL原本のSHA256とcheckout SHAを確認し、不一致なら停止。候補SQLは使い捨てDB内のみ。実DBの役割/権限/スキーマ構成がfixtureと同じだと仮定せず、差分をA1等の判定に明記する。
5. G1不変digest・G2請求の本人確認・G4むせによる実行対象HEAD監査・G5Atsuo明示承認が一つでも欠ける場合、**起動操作そのものを実行しない**。既存workflowのハードストップ維持。

### 失敗時の停止・cleanupの必要条件

| 発生条件 | ジョブの扱い | 必須の後処理と証拠 |
|---|---|---|
| G1〜G5未成立、digest/checkout不一致 | 起動禁止、NOT RUN | 未起動を記録。PASS扱いしない |
| localhost以外の接続先、想定外通信、本番認証情報の存在 | 即時停止、FAIL | リクエスト中止、コンテナ・ネットワーク・一時資格情報破棄の確認 |
| Auth/JWT署名・role・期限切れ・RLSに不一致 | 検査停止、FAIL/NOT PROVENを分離 | 対象サービス・一時データを廃棄、観測ログを秘密値なしで保持 |
| 1001件の誤許可・他人の行露出・候補SQLハッシュ不一致 | 即時停止、FAIL | 露出データをログ/成果物に残さず、サービス破棄・原因を記録 |
| テスト自体の失敗、timeout、途中キャンセル | 合格不可 | 成功／失敗のどちらでも後処理を試行。途中キャンセル時はrunner自体の使い捨て性を別途検証 |
| cleanup失敗・未確認 | 最終結果FAILまたはNOT PROVEN、**PASS禁止** | 停止できたと推測しない。終了コードと未片付け対象を記録 |

- 将来のrunnerでは、検査の例外や失敗に関係なくcleanupを実行する仕組みを備え、**cleanupの失敗で最終結果が成功へ上書きされない**ようにする。ジョブ強制終了時に後処理が実行できると保証しない。
- 成果物は**機密を含まない要約だけ**を想定。保持期間・サイズ上限・請求影響はG2で確認して初めて固定する。未確認のままartifact uploadを有効化しない。
- 記録必須項目：JST実行時刻、対象HEAD、依存digest/platform、使用した合成fixture版、各ケースPASS/FAIL/NOT PROVEN、停止理由、cleanup終了コードと最終残存状態、請求確認。JWT全文・ログイン情報・実メールは禁止。
- `tests/rings-now-p2-loopback-transport.cjs` は独立したHTTP限定部品であり、**実サービスを起動・管理するrunnerではない**。3秒ソケットtimeout・5秒絶対期限・64KiB上限を持つが、これだけではG3完了としない。

**G3の現在判定：設計上の受け入れ条件を追記、実装・実runnerの監査・cleanup実測はNOT RUN。**

## 次の安全な作業順

1. G1の公式digest・互換構成とG2の実アカウント請求証拠を、推測を混ぜず取得・記録する。
2. G3の起動/停止仕様を作り、停止したままレビューできる実装HEADを用意する。
3. G4むせ独立監査後、G5をAtsuoへ別途確認する。**その前のworkflow停止解除・dispatchはしない**。
4. 承認後に限り一時環境で観測し、H1–H6の証拠を判定する。

**この文書は実行許可ではなく、未解決事項を可視化した開発資料である。**
