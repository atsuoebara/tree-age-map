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
| G2 | GitHub Actions費用が追加0円である根拠 | NOT VERIFIED | 対象アカウントの請求画面・利用枠・公開repoの実条件・保存量・支払い上限等を本人確認。未確認ならSTOP |
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

## 次の安全な作業順

1. G1の公式digest・互換構成とG2の実アカウント請求証拠を、推測を混ぜず取得・記録する。
2. G3の起動/停止仕様を作り、停止したままレビューできる実装HEADを用意する。
3. G4むせ独立監査後、G5をAtsuoへ別途確認する。**その前のworkflow停止解除・dispatchはしない**。
4. 承認後に限り一時環境で観測し、H1–H6の証拠を判定する。

**この文書は実行許可ではなく、未解決事項を可視化した開発資料である。**
