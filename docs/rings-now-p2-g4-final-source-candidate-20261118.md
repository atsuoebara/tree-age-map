# リングスナウ G4 — 最終実証ソース候補（実行禁止のまま）

2026-11-18。ベースmain `d26b0cad3910b3b52bb042ecc053f5bcc4fcde09`（#244マージ後）。
**これは隔離実行の許可・G4合格・B案最終採用ではなく、実行用ソースの監査候補Draft。**

## このPRで変更すること

`tests/rings-now-p2-real-docker-runner.cjs` に残っていた `h2_original_gotrue_expiry_not_wired` の無条件停止ブロックを削除。#240/#241の元GoTrue JWT実時間失効→A/B再認証→H2 7ケース配線を、将来**正規のmanifest承認がすべて揃った場合だけ**通過できるソース候補にする。

**重要な順序は維持：**
1. `validateLiveManifest(activeManifest)` をDocker adapter・runtime・commandFactory構築より前に実施
2. canonical commandFactory の場合、`manifest!==activeManifest` または `runtimeFactory!==createEphemeralP2Runtime` は無条件拒否
3. 不承認／未検証／権限不一致は `BLOCKED_NOT_RUN` でreturnし、Docker呼び出しなし
4. 全承認が成立した後のみcanonical real Docker adapter経由で隔離ランが可能になる候補
5. 実行結果は `g3Verified:false`、`actualP2Proven:false`、`p2ExecutionAuthorized:false` のまま。ログ・CLI結果でG4成功を自動認定しない

既存 `tests/rings-now-p2-real-docker-runner.test.cjs` に正規の現在manifestでDocker前にBLOCKする回帰と、無条件ガード削除・manifest事前検査順・休眠workflow維持を追加した。

## 変更しないこと

- `.github/workflows/rings-now-p2-isolated-manual.yml`：`if: ${{ false }}`、manual-only、12分、標準runner、read-only、固定checkout、B親検査すべて維持
- `tests/rings-now-p2-isolated-manifest.json`：`BLOCKED_NOT_RUN`、`checkoutCommit:null`、`independentAudit:PENDING`、`billingZeroAdditionalCost:NOT_VERIFIED`、`explicitExecutionApproval:false`、`productionAccess:false` 維持
- DB、本番Supabase、SQL候補、サービス設定、画像digest、#109/#201 HOLD、本番OFFは変更なし
- Docker・SQL・GitHub Actionsの実走行や課金操作を行わない

## 監査で否定すべきリスク

- 元GoTrue JWTをH1から保持し、改変せず実時間失効（exp+1秒）後にだけPostgRESTへ送信するか
- 再ログインしたA/Bセッションと、別の低権限JWTの正当性を混同しないか
- H2前後の時間・cleanup/verify予約。実環境での起動119秒以下、ジョブ12分以下は**未実測**
- GoTrue migration、SQL bootstrap、PostgREST JWT設定の実互換性は**未証明**。初回実DockerがFAILになる可能性はある
- CLIは成功をG4合格に偽装しないか、後片付け・秘密情報・所有ラベルは確実か
- このPRの実行禁止境界が削除の影響で弱まらないか。承認済みfixtureによるoffline合成テストは実行承認ではない

## 次の段階（このPRの範囲外）

- むせによる**正確なHEADでのソースコード監査と実Node回帰テスト**
- sourceSha確定後、B方式のapproval-only子を別の作業で作成（その子に**runner変更を含めない**）
- 本人がBillingの適用条件を実行直前に確認し、承認証拠を保存
- manifestの状態遷移・独立監査HEAD照合、workflowガード変更の最終監査
- Atsuoが**最終実行コミットを指定して明示的に隔離実行承認**してから初めてActions実行。G4判定は実測HTTP/JWT・タイムアウト・cleanup証拠に基づく

## むせ監査コマンド

```sh
node --check tests/rings-now-p2-real-docker-runner.cjs
node --check tests/rings-now-p2-real-docker-runner.test.cjs
node --test tests/rings-now-p2-real-docker-runner.test.cjs tests/rings-now-p2-h2-runner-bridge.test.cjs tests/rings-now-p2-g4-approval-child.test.cjs tests/rings-now-p2-stack-static-gate.test.cjs tests/rings-now-p2-cli.test.cjs
```

開発者側で**NodeとDockerの実測は未実施**。ステータスPASSを捏造しない。差分は既存runner・既存runner回帰テスト・この文書のみであるべき。段階合格はマージ・有効化・実行の承認ではない。
