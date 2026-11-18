# リングスナウ G4 — 12分ジョブ余裕（休眠構成のみ）

Base: main `3ece5aeb117b01f288546010b84e5deebbed2430`（#242マージ後）。分類：有効化準備の本道、**有効化ではない**。

## 修正内容

- `.github/workflows/rings-now-p2-isolated-manual.yml`: `timeout-minutes: 10` → `12`（仮設計）。`if: ${{ false }}`、手動ディスパッチ限定、単一標準ubuntu job、同時実行1、固定checkout digest、厳密なCLI失敗コード、権限read-onlyは変更しない。
- `tests/rings-now-p2-stack-static-gate.cjs` と回帰テスト：休眠workflowは12分**ちょうど**でなければ拒否。10、13、60への改変も拒否。
- `tests/rings-now-p2-g2-cost-envelope.cjs` とテスト：ドキュメント上の標準runner上限を12分に整合させる。**この変更は課金なしの証拠でも、実行資格の証拠でもない**。記録は引き続き `g2Verified:false` と `p2ExecutionAuthorized:false`。
- `tests/rings-now-p2-g4-activation-readiness.test.cjs`：リポジトリの実休眠workflowが12分かつ静的チェック合格でも、実測のない有効化判定はBLOCKのままと確認。

## 名目予算

| 項目 | ミリ秒 | 説明 |
| --- | ---: | --- |
| Actions job上限候補 | 720000 | 12分（まだ実測/請求未検証） |
| runner既定上限 | 600000 | 10分（変更なし） |
| 予定上のjob残余 | 120000 | checkout、準備・後処理の名目枠 |
| runner cleanup予約 | 120000 | runner自身が内部で確保（変更なし） |
| execute上限 | 480000 | cleanup差引後 |
| TTL厳密失効 | 301000 | 300秒+1秒 |
| 待機後予約 | 60000 | A/B再ログイン、SQL、7 HTTP |
| execute開始→bridgeの名目枠 | 119000 | 実測未了 |

120秒のjob余裕は **Dockerイメージダウンロード／checkout／起動などの実測結果ではない**。runnerの内部600秒はexecute・cleanupを含み、workflowにおける実際の前処理時間の測定はまだない。各ステージの最悪値合計が12分に入ると約束しない。

## まだ解消していない最終条件

1. G2鮮度：GitHub Billing画面で、標準runnerの適用条件・課金防止・予算上限・12分枠の影響を本人が確認する。0円の追加費用を無検証で宣言しない。
2. 実測：最初の独立承認済み隔離実走行で、画像準備、起動、SQL/H1、元JWT実失効、再ログイン/H2、cleanup、workflow前後処理の経過を確認する。119秒等を超えれば**再試行前に設計見直し**。
3. checkoutCommit：#242はsourceShaとapprovalShaのB案を候補として定義しただけ。親子コミットと実差分を独立監査し、A/B方式を最終確定する。
4. 有効化：正確な最終HEADに対するむせ監査、マニフェスト遷移、実Dockerガード変更、workflow `if:false` の変更、Atsuoによる**別途明示的な実行承認**が必要。

**このPRはむしろ現行ガードを保持し、実際にはジョブを起動できない。** manifestは `BLOCKED_NOT_RUN`、`explicitExecutionApproval:false`、`productionAccess:false`、`checkoutCommit:null`、guard `h2_original_gotrue_expiry_not_wired`、#109/#201 HOLD、本番OFFが不変。

## むせ監査

```sh
node --check tests/rings-now-p2-stack-static-gate.cjs
node --check tests/rings-now-p2-g2-cost-envelope.cjs
node --check tests/rings-now-p2-g4-activation-readiness.test.cjs
node --test tests/rings-now-p2-stack-static-gate.test.cjs tests/rings-now-p2-g2-cost-envelope.test.cjs tests/rings-now-p2-g4-activation-readiness.test.cjs
```

失敗すべき10/13/60分改変が実際に失敗すること、請求ゲートが依然文書上の非証明であること、12分実workflowでも実測なしBLOCK、他のmanifest/runner/実行禁止ガードが無変更であることを検証。Nodeコマンドは作成者未実行。**段階PRの合格でもマージ・実行承認にならない**。
