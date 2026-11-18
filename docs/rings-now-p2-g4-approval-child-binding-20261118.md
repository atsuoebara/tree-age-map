# リングスナウ G4 — 承認専用子コミット B方式の実Git検証（休眠）

Base main `1cf8244882b65674bea53c53bebb44c8bf554187` (#243マージ後)。
**このPRは有効化ではなく、B方式の具体的な実行前検査を準備するDraft。**

## 解決する問題

Gitコミットは自分自身の SHA を自分のファイルに入れられない。そのため `checkoutCommit=approvalSha` は自己参照となり不可能。

採用候補のB方式：
1. まず `sourceSha`（実Dockerが動くコード＋安全契約を独立監査したコミット）を確定
2. 別の承認専用 **単独の子コミット** `approvalSha` を作る。**変更をmanifest / workflowだけに限定**。子が持つ manifest.checkoutCommit は直接親 `sourceSha` を指定
3. workflow の実行checkoutは `GITHUB_SHA=approvalSha`、manifestの `checkoutCommit=sourceSha` に分離
4. 実行時、`git rev-parse HEAD`、`git rev-list --parents -n 1 HEAD`、`git diff-tree ... HEAD` を**固定のargvのみ**で取得し、単独親と変更対象2ファイル制限をfail-closedで照合
5. 並行してmanifestの監査済みHEAD、Billing、本人の実行承認を別の事前ゲートで厳密確認する。コード自身が承認を発行しない

**重要：承認子では実Docker runner本体のガードを変更できない。** 実行を許すソースコードの監査は、`sourceSha` に対して事前に実施する必要がある。承認子はそのソースを動かす最小差分である。

## コード内容

- `tests/rings-now-p2-g4-approval-child.cjs`：純粋検査。親が1つだけ、SHA整合、許可2ファイル以外の変更なし、本番アクセスfalse。不正入力はBLOCK。形式上合格でも`executionAuthorized:false`・`g4Verified:false`
- `tests/rings-now-p2-g4-approval-child-cli.cjs`：実Gitの固定サブコマンドでcheckout HEAD・親・実差分を読み、純粋検査へ渡す。秘密・任意コマンドを含めない。import時副作用なし
- workflow：`fetch-depth: 1`→`2`（親の確認用）、manifestのpreflight **より前に**新CLIを追加
- static gateと回帰テスト：Git照合CLIとdepth=2を必須にする
- テスト：偽親、マージコミット、自己参照、無関係ファイル、浅いcheckoutを拒否

## 不変条件と残り

workflowは**`if: ${{ false }}` のまま**。manifestは `BLOCKED_NOT_RUN`、`checkoutCommit:null`、`explicitExecutionApproval:false`、`productionAccess:false` のまま。実Dockerの `h2_original_gotrue_expiry_not_wired` ガード、#109/#201 HOLD、本番OFFを保持。Actions/Docker/SQLは呼び出さない。

本番G4には、完全な有効化ソース候補に対する独立監査、最新Billingの本人確認、本人からの実行の明示承認、実環境での時間実測、G4のHTTP・JWT・後片付けの独立検証が残る。B方式はこのPRの合格をもって採用決定にはならない。

**Github公式**では公開リポジトリの標準ubuntuランナーの使用は無料とされている。対象リポジトリの可視性は GitHub appで `public` と確認できた。ただし請求アカウントの情報は未取得、外部サービス・アーティファクト有償利用のない構成とする条件は継続確認する。

## むせ監査手順

```sh
node --check tests/rings-now-p2-g4-approval-child.cjs
node --check tests/rings-now-p2-g4-approval-child-cli.cjs
node --test tests/rings-now-p2-g4-approval-child.test.cjs tests/rings-now-p2-stack-static-gate.test.cjs tests/rings-now-p2-g4-activation-readiness.test.cjs
```

- 現在のmanifestのままでは実行に進まないこと
- 単独親を改ざん・複数親・自己参照・許可外の変更・depthを1に戻すと失敗すること
- CLIの固定git argv、Secrets/env/任意branch選択なし
- sourceShaとapprovalShaの意味、実行refが承認子に固定されるか
- 既存本番・workflowの停止状態を確認

**段階合格はマージ・有効化・実行承認ではない**。
