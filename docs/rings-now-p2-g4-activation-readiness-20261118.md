# リングスナウ G4 — 有効化前の時間・checkout監査ゲート（2026-11-18）

**分類：有効化の前提条件整備。実行不可・G4未達。**

Base: main `60c6c5073ff71fd956b3df0d17eb13b6dfd00f46`（#241マージ後）。追加はオフライン2ファイルとこの文書のみ。既存runner・マニフェスト・workflow・請求設定・本番コードは変更しない。

## むせ観察1：実測がない

現行600秒runnerの予算内訳は execute 480秒、後片付け120秒、JWT厳密失効301秒、失効待ち後の最低予約60秒、したがって起動・初期化・SQL・H1の名目枠119秒。

`inspectG4ActivationCandidate` は以下の**同一隔離走行に関する時間区間**の根拠（外部から提供された監査資料）を要求する。
1. execute開始からH2ブリッジまで
2. 元GoTrue JWTの実時間失効待ち（301秒以上）
3. 待機後：A/B再ログイン、シード、7ケース
4. 後片付けと確認
5. Actions checkout、イメージ準備、前後処理を含むjob overhead

境界違反は拒否する。ただし入力は申告値なので、本コードは**実測の真正性を検証しない**。ユーザーの別途実行承認を受けてからの隔離実走行で、時刻付きログ・実際のcheckout・画像準備・後片付けとともに確認するまでは未解消。

## むせ観察2：ジョブ上限10分とrunner600秒が同値

現行workflow `.github/workflows/rings-now-p2-isolated-manual.yml` は10分、`if: ${{ false }}`。CLI runner予算600秒のため、ジョブ側の余裕はゼロ。**そのままの有効化を拒否**。

将来の有効化変更では、計測されたoverheadと実際のrunner全工程に基づいてジョブ上限を再設計する必要がある。12分などの例示値は実行可能・無料を意味しない。既存G2費用 envelope `maxJobMinutes=10`、既存 `inspectDisabledWorkflow` の `timeout-minutes: 10` 固定と矛盾するので、将来の改訂を別途監査する。Actions課金とアカウント利用条件の確認なく一方的に上限を引き上げない。

## checkoutCommit の A/B 論点：B（承認専用子コミット）を候補として明示

自己参照SHAをマニフェストに埋めることはできないので、`checkoutCommit` を『実行する承認コミットの自分自身のSHA』にはしない。候補は：
- **sourceSha**: 開発・監査済みコードの不変SHA
- **approvalSha**: sourceShaを直接親とする承認専用子コミット。変更は許可されたmanifestとworkflowだけ
- workflow `github.sha`/checkout は **approvalSha**、manifest `checkoutCommit` は **sourceSha** の意味で分離
- 承認専用子がコードを変えないこと、実際のGitHub parent/diffを監査で検証し、最終HEADで再監査する

このPRの検査は渡されたSHAや変更パスの**形式・宣言整合性だけ**を見る。GitHub親子関係や中身の不変性は証明しない。A案（外部の監査承認SHAを別途管理）との最終比較・採用も有効化監査で行う。**現時点でB案を許可・確定したものではない。**

## 安全境界

返り値は全条件が形だけ揃っても `DOCUMENTARY_CANDIDATE_ONLY_INDEPENDENT_VERIFICATION_REQUIRED`、`safeToEnable:false`、`executionAuthorized:false`、`g4Verified:false`。外部実測の代替にはならない。

現行workflowの `if:false`、manifest `BLOCKED_NOT_RUN`、`explicitExecutionApproval:false`、`checkoutCommit:null`、`productionAccess:false`、実runnerの `h2_original_gotrue_expiry_not_wired` ガード、#109/#201 HOLD、本番OFFを維持。実Docker、SQL、Actionsは実行していない。

## むせ監査依頼

対象新規3ファイルに限定して差分確認。実Nodeで：

```sh
node --check tests/rings-now-p2-g4-activation-readiness.cjs
node --check tests/rings-now-p2-g4-activation-readiness.test.cjs
node --test tests/rings-now-p2-g4-activation-readiness.test.cjs tests/rings-now-p2-stack-static-gate.test.cjs tests/rings-now-p2-g4-h2-budget-envelope.test.cjs tests/rings-now-p2-cli.test.cjs
```

観察1・2が未実測/未改訂であること、10分ジョブは確実にBLOCK、申告値を偽造しても実行承認に昇格しないこと、親SHAの実証を捏造しないこと、現行ガード／workflowが全く変わっていないことを独立監査してほしい。

**これは有効化PRではなく、有効化条件を安全に定義する前提PR。マージ・実行には別途本人承認が必要。**
