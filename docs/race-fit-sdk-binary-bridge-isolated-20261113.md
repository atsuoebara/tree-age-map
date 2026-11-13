# FIT SDKバイナリ→本人提供FITの1km経過時間候補：隔離PoC

日付：2026-11-13、対象：Draft PR #67

## 作業の範囲
- `src/race-fit-sdk-isolated-adapter.mjs` を追加。現行 `fit_importer.js` と同じ `fit-sdk/src/index.js` の `Decoder`/`Stream` を使用するが、**既存FIT取り込み本体には一切import・変更しない**。
- FITファイルは利用者がブラウザで渡す場合を想定した`ArrayBuffer`であり、今回のテストは**Garmin FIT SDKの`Encoder`で新規生成した完全な架空バイナリ**のみ。利用者ファイル・Supabase・Strava API・Garmin APIは取得しない。
- `Decoder.read()`が返す `sessionMesgs[0].sport`、`sessionMesgs[0].startTime`、`recordMesgs[].timestamp`/`distance`（任意で`heartRate`/`cadence`/`power`）を使う。既存runの更新や年輪ルートの再生成は行わない。
- 既存の`race-user-fit-only-gate.mjs` と `race-fit-only-split-probe.mjs` へ**値を渡すだけ**の独立アダプター。出力は`synthetic_candidate_only`で `analysisAllowed:false`、`writeAllowed:false`、`providerDataCombined:false`、`qualityCertified:false`。

## 確認できたこと
- 生成したFITバイナリを同じFIT SDKのDecoderで読み直し、1,000m区間がそれぞれ300秒で一致。
- `session.startTime`と先頭レコードtimestampの一致、先頭累積距離ゼロ、単一のrunning session、timestamp型と累積距離数値、レコード数上限、本人提供フラグ・非公開画面・出所（user_uploaded_fit）を安全側で確認。
- 確認失敗、Strava由来やGarmin API由来、複数セッション、異種目、不正な累積距離、非FITバイナリは拒否する。
- FIT SDKから得られた実型（JavaScript Date）を基準に計算。心拍などの集計や距離・時刻の推定補完は行わない。
- `tests/race-fit-sdk-isolated-adapter.test.mjs`は完全合成のFITバイナリ生成と解読を行う。GitHub Actions **#43355000730 completed/success**、対象ステップ`Verify generated FIT binary SDK decode to isolated kilometre probe`もsuccess。

## 重大な限界・今後の設計ゲート
1. 生成した架空のFITバイナリは既知の単純なfieldだけ。**実Garmin・COROSのFITファイル検証ではない**。実際の`timestamp`/累積距離/センサー欄、developer fields、Lap、Pause/Resume、クロックずれ等は未確認。
2. 最初のrecord timestampがsession開始時刻と一致し、累積距離0mから始まる場合**だけ**受理。現実のデバイスでは先頭サンプルが遅延・欠損するため、現在は多くの実ファイルを拒否する可能性がある。時刻や距離を勝手に埋めない。
3. FIT decodeのerrorsがある場合拒否。SDKが解読できても、FIT全体の完全性・停止時間・GPSフリーズ・時間品質・自己所有性を検証したとはみなさない。
4. 作った1km値は**線形補間による候補**で、公式大会ラップやトレーニング推奨の根拠にはしない。センサー平均・データ保存・UI表示は未実装。
5. Strava Ticket #19691は自動返信のみ。Strava API由来データとの結合、保存済みStravaランへのマッチング・データ混在、Garminの旧DELETEと新再認可の影響は別途公式回答待ち。
6. 本番の`fit_importer.js`、`index.html`、Supabase、Garmin Push/OAuth、COROS/Strava、保存run、年輪、Connect IQは**変更なし**。実データ試験・本番適用前にむせの独立監査とオーナーの明示承認を要する。

**判定：架空FITバイナリのSDK round-trip・解析候補生成まで隔離合格。本番No-Go。PR #67 Draft、#68 HOLD。**
