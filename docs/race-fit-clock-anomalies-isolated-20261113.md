# FIT時刻異常：先頭遅延・停止イベント・記録欠損の隔離診断
2026-11-13 / PR #67 Draft / 本番No-Go

## 実装
- `src/race-fit-clock-anomaly-review.mjs`：実装済みの`normalizeDecodedFitForOfflineProbe`を変更せず、その前後でFIT SDK decode結果の時刻異常を診断する独立レビュー専用関数。
- `tests/race-fit-clock-anomaly-review.test.mjs`：架空のdecode shapeと、リポジトリのGarmin FIT SDK Encoder/Decoderによる生成FITバイナリをテスト。ファイルの保存・API通信・ストレージ変更・ユーザーデータの読み取りなし。
- CI `.github/workflows/garmin-sample-shape-probe.yml`にテストを追加。

## 判定条件
1. sessionと最初のrecordの時刻が一致しない場合は`first_record_delayed_clock_unknown`を記録し、既存の厳格アダプターは`record_and_session_start_must_match`で拒否。開始数秒間を推測補完しない。
2. 最初の累積距離が0mでない場合は`first_distance_nonzero_origin_unknown`とし、厳格アダプターは`cumulative_distance_origin_not_zero`で拒否する。開始距離の勝手なゼロリベースはしない。
3. レコード時刻の欠損・非単調、距離の逆行・負値・非数値を明確に拒否。
4. レコード間隔が120秒を**超えた**場合は`long_record_clock_gap`。値は未検証の参考しきい値で品質認定には使わない。
5. 同距離で時間だけ進む場合`distance_plateau_cause_unknown`を付ける。信号待ち・自動停止・GPSフリーズは同一視しない。
6. timer start/stopイベントを認識した場合は`timer_event_present_verify_pause`で注意喚起。イベントの存在のみでは原因を確定せず、端末によりeventTypeの実測値は変わり得る。
7. すべて`status:diagnostic_only`または`blocked`で、`qualityCertified:false`、`analysisAllowed:false`、`writeAllowed:false`、`providerDataCombined:false`。計算済みラップの本番承認は行わない。

## 検証と未解決
- GitHub Actions **#43355503913 completed/success**。`Verify FIT clock anomalies and no imputed timestamps` success、旧FITおよびGarminの隔離テストもsuccess。
- 生成FITバイナリの先頭recordがsession開始+7秒で、次のrecordまで180秒空くケースを実際にSDKでencode→decodeした上で、先頭遅延と時刻ギャップの両フラグを確認。
- **実GARMIN/COROS FITのタイマーイベント、autopause、レコード欠損、時刻ずれ、SDK互換性は未検証**。ポーズ区間の正しいレース経過時間と自動停止の影響は別途検証が必要。
- 既存`fit_importer.js`、Strava、COROS、Connect IQ、Garmin API/OAuth、Supabase、runs、年輪、Journalの変更なし。
- Strava Ticket #19691は自動返信のみで分析・長期保持の許可未確認。GarminのDELETE再連携問題は公式回答待ち。
- 今後、実端末由来ファイルは本人の明示同意を取得したうえ、検証範囲とデータ保存場所を別途承認してからのみ検討。
- むせの独立監査とオーナー承認前の本番導入不可。PR #67 Draft、PR #68 HOLD。
