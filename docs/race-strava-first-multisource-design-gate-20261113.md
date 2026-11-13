# Race Compare / 1km分析：Strava中心・マルチソース補助の隔離設計ゲート

日付：2026-11-13 / Draft PR #67 / **実ユーザーへの導入・本番反映No-Go**

## ユーザー方針
ランニング履歴・カレンダーの基本の入り口はStravaとする。Garmin、COROS、Connect IQ、FIT/TCXは補助詳細ソースとなり得るが、既存Stravaランを無条件で上書き・二重登録しない。Strava不使用者の既存経路は廃止しない。分析は本人だけの任意機能。

## 現行実装に照らした事実
- `how-to.html` はStrava、Garmin Connect、Garmin Connect IQ、COROS、Intervals.icu、ファイル取り込みの複数経路を案内し、二重取り込みに注意喚起。
- `HANDOFF-GARMIN-ACTIVITY-PUSH.md` はGarmin Push側の同一ソースIDおよび時間/距離による他ソース照合を記録。開始時刻差2分、距離差3%（最低100m）の既存基準でも同時保存や識別不能ケースを完全には防止できない。
- `garmin-activity-push`は受信`sanitized`で位置だけ保存し、1km詳細センサー標本を現行受信に保持していない。Garmin詳細分析は別の許可・保存設計が必要。
- `garmin-api-setup.sql`によれば、Garmin Connect OAuth連携とGarmin Connect IQは独立の接続テーブル。両方の利用者について一方の認可を他方と混同しない。
- Strava公式APIには本人が許可したactivity streamsの取得APIが存在する（`GET /activities/{id}/streams`）。`time`・`distance`等の利用可能なstreamはアクティビティと権限に依存。データを必ず取得できるとは想定しない。
- 2026年のStrava API契約では本人以外へのStravaデータ表示不可・保持規定・取得するデータの範囲変更時の本人同意等の制約あり。APIを使う場合、保持期間と加工データの扱いの法務・規約監査が必要。公開の位置情報、年輪、共有、ランキング等にStrava詳細データを無断で混ぜない。

参考（2026-11-13確認）：
- https://developers.strava.com/docs/reference/ （Get Activity Streams）
- https://www.strava.com/legal/api_policy
- https://support.strava.com/en-us/articles/15401608-api-agreement-update-how-data-appears-on-3rd-party-apps

## 今回の隔離コード
- `src/race-strava-first-match-contract.mjs` は本番非接続の純粋関数。カレンダーで選んだ**元の保存ラン**を常に正本とし、元がStravaならStravaの記録IDを保持する。
- 同一owner、非公開本人画面、本人の追加解析同意、ランの距離・開始時刻、ランニング種別、時系列距離・時刻の存在を要求。候補照合は開始2分以内・距離3%以内（100m以上許容）で、単一候補でも自動取込/マージ**禁止**。
- 2つ以上の候補（例：Strava同期 + Connect IQ + Garmin直接送信）で自動選択禁止。候補1件でも`review_candidate`にとどめ、本人の元アクティビティ確認・権限確認が済むまで`writeAllowed=false`。
- Connect IQとGPXは時系列解析が確実な形で供給されると現在証明できないので、この契約では解析候補としない。今後、センサー標本が安全に使えると確認されれば再設計する。
- Garmin/COROS/FIT/TCXは設計上候補にできるだけ。現行の直接API・ファイル取り込みがこの判定コードに接続されたわけではない。
- 正式な詳細解析に必要な時系列標本の品質検査、手動での同一性確定、端末/アカウント連携の本人同意、保存期限、削除・失効時の徹底削除、API制限、二重イベントの原子的結合は未実装。個別providerの利用規約に適合するか判定前は実データに触れない。
- 本テストの`t`、所有者識別子、レース距離とIDは完全な合成値。本番runsへの書込みやAPI呼出しは一切ない。

## 本番 Go/No-Go
1. Stravaのstreams取得に必要なscopeと実際のサンプル可用性を本人の明示同意に基づき検証。
2. Strava APIの保持期限・派生データ保存・本人以外への表示禁止・データ削除の規約適合性を監査。
3. 既存runsを正本にして詳細解析だけを分離するデータモデル、同時保存衝突と削除・解除・撤回のトランザクションを設計。
4. Garmin公式API/OAuth遠隔DELETE問題とCOROSデータ権限は別ゲートとして保持し、Garmin回答前に本番へ流用しない。
5. 既存Strava、COROS、Connect IQ、GPX/FIT、年輪、Journal、ACK、ランキング、本人同意と無料枠を退行させない。
6. むせの独立監査・オーナーの明示承認が必要。

**判定：Strava-firstへの方向転換は設計案として採用。隔離テストは正本保存・二重登録防止の候補判定のみ。本番No-Go。PR #67 Draft、PR #68 HOLD。**
