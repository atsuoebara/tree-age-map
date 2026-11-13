# FIT Timer Event（停止・再開）と時計上の経過時間：隔離監査ゲート
- 日付：2026-11-13
- 対象：PR #67 Draft。**本番No-Go、実ユーザーデータ・DB・API呼び出しなし**

## 今回の実装
- `src/race-fit-timer-event-review.mjs` を新設。FIT SDKでdecodeされた`sessionMesgs`、`recordMesgs`、`eventMesgs`を読み取り、timerの`stop`（含`stopAll`等）と`start`の順番を診断。既存`fit_importer.js`、`race-fit-sdk-isolated-adapter.mjs`、`race-fit-only-split-probe.mjs`は変更しない。
- `tests/race-fit-timer-event-review.test.mjs`を新設。合成したdecode結果と、リポジトリ付属FIT SDK `Encoder`→`Decoder`の完全架空バイナリで停止・再開を検証。
- `.github/workflows/garmin-sample-shape-probe.yml`にテスト実行ステップを追加。

## 算術の大原則
1. 1kmの区間時刻は`record.timestamp`の時計上の経過秒に基づく。timer停止区間を差し引かない。**moving time / moving paceと呼称しない**。
2. 例：0秒開始、100秒で停止、160秒で再開、260秒で1kmの架空記録は**1km=260秒**。停止イベント間が60秒あっても200秒に短縮しない。
3. Eventのみでは、デバイスの自動停止設定、GPSフリーズ、停止原因やイベント欠落を特定できない。timer event不在でも継続走行を証明できない。
4. `stop`→`start`の正常ペアは`observedStopIntervals`に開始・終了オフセットと秒数を**診断値として**保存するが、停止秒数をpaceから除外する計算関数は作らない。
5. timerイベントの時刻欠落、時刻逆行、セッション開始から最終記録の外にあるイベントは`blocked`。開始イベントだけ、閉じられない停止、停止重複、ゼロ時間の停止・再開、認識できないeventTypeは不確実フラグで保持。
6. 本人提供FIT、running session、本人同意・本人専用画面が入口要件。StravaなどAPI由来データは拒否する。実アカウントの同意や著作権・データ出所をこのsynthetic関数だけで証明できるわけではない。
7. **`analysisAllowed=false`、`writeAllowed=false`、`qualityCertified=false`、`movingTimeCalculated=false`、`providerDataCombined=false`**。既存年輪・ランの再保存・削除も行わない。

## テストの限界
- 完全架空のFITバイナリでSDK Event解読の挙動まで確認。実Garmin/COROS FITによるイベント名称・auto-pause仕様の検証ではない。
- イベント時系列は真の運動の有無を示す認定情報ではない。FITラップ・elapsedとtimer timeの食い違い、GPS停止、失われた最終サンプル、時計停止、競技計時との比較は未検証。
- 現行の`race-fit-only-split-probe.mjs`はイベントを参照しないため、FITから抽出した時計経過時間を勝手に移動時間へ変換しない。
- Strava開発者チケット #19691 は分析許可の具体回答待ち。Garmin旧DELETE再連携の公式回答も待機。本番に適用するには、実ファイルの本人承認、端末別PoC、むせ独立監査、オーナー最終承認が必要。
- **PR #67 Draft、PR #68 HOLD、マージ・デプロイ・本番変更ゼロ**。
