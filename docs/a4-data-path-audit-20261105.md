# A-4 第1弾「初めての30km」実装前データ経路確認（2026-11-05）

状態：コード・設計資料の読み取り調査。**本番DBは直接参照していない**。機能の実装、デプロイ、承認ではない。

## コードから確認した事項
- `public.runs` の保存距離は `distance_km`（Garmin保存SQLではkmで挿入、Garminの重複判定でもkmとして使用）。距離の表示・数値演算も `rr-engagement.js` 等で `Number(r.distance_km)`。
- `runs` の `id`、`user_id`、`activity_date`、`started_at`、`distance_km`、`route`、`deleted_at` が既存SQL/JSに現れる。
- 個人用A-3の取得例は `supabaseClient.from('runs').select('id,activity_date,distance_km').eq('user_id',user.id).is('deleted_at',null)`。A-4も本人認証/RLSと削除除外を前提にする。
- Garmin取り込みの有効GPS条件は `route` が2点以上（非indoor）だが、**他ソースすべてのルート形式や有効GPSの判定が同じとは未確定**。
- `started_at` はGarmin経路でtimestamptzとして扱われる一方、他ソースの日時欠損・形式や、保存済みラン一覧の全取得方法は未照合。
- `get_import_share_origin_page` はB-1の内部用RPCであり、本人用一覧とは用途・取得権限が異なる。A-4の利用者記録取得に転用しない。

## 確認・実装上の判断
- 判定距離は表示用に丸める前の `distance_km`。閾値は実値で **30.000km以上**。整数メートルへの丸め変換は行わない（例：29.9995kmを30000mへ四捨五入すると誤判定）。
- 第1弾は、ログイン本人の削除されていないRun／Trail Run／Virtual Runのうち、保存ルートが有効な1件を候補とし、`started_at` 昇順（同時刻は `runs.id`）で初達成を選ぶ。
- 活動種別の既存実保存列・正規化ルール、各ソースのGPS配列構造・有効基準、日付・タイムゾーンを**実装前に読み取り専用で確認**する。データに存在しない列を想定して新機能を作らない。
- 本人の保存済みラン一覧と違う母集団にならないことを検証。第1弾で未確定の活動種別を推測して全行を「ラン」と扱うことは禁止。
- 一度に1000件取得する既存A-3の方式を無批判にコピーしない。全期間から初達成を選ぶため、利用者の件数を安全にページングする必要がある。ページング／検索・日付ソートは別途確認する。
- 「初めて」は「取り込まれた記録の範囲で」と注記。過去のラン追加／削除で再計算、未達は明示。公開面、共有画像、DB書き込みなし。

## 第1弾の受入試験（合成データ）
1. 29.999km → 未達、30.000km → 達成、29.9995km → 未達。
2. GPSポイント不足、GPSなし、無効緯度経度 → 未達。
3. 同日で開始時刻が違う2ランは時刻順。同時刻なら `runs.id` で決定。
4. `started_at` 欠損、削除済み、対象外活動は除外。
5. 過去ラン追加で初達成が変わる／削除で次の候補へ移る。
6. Strava/Garminなどの異なるソースの同一活動について既存保存一覧を参照し、A-4で独自重複削除を行わない。
7. 日本語／英語、未達、エラー、未ログイン、取得件数が多いケースの動作。
8. 既存 Today／A-3／Territory／取込／ログインに回帰影響がない。

## 未解決ゲート
- 現行index.htmlの本人保存一覧の取得・ページングを完全に追跡
- 全取り込み経路の活動種目・GPS有効判定の確定
- 本番スキーマの読み取り専用確認（必要に応じて）
- 実装後の合成テスト、むせ独立差分監査、Atsuo最終承認

**本メモだけでは実装準備完了や公開合格を宣言しない。**


## 追加調査：index.html 保存済みランの実経路（2026-11-05）
- `fetchCloudRuns()`（index.html 12280行付近）は、ログイン中の `currentUser.id` を指定し、`deleted_at=is.null` で絞って、`limit=50&offset=...` を使い全ページを取得する。50件未満のページで終了し、途中のHTTPエラーを無視しない。
- 現在の取得列は **id, created_at, activity_date, name, distance_km, route, user_id, strava_id, source, started_at**。**活動種目列は含まれない**。第1弾でRun／Trail Run／Virtual Runを確定するには、既存の保存仕様・実スキーマで種目を保持するか調査が必要。種目を推測して30km達成を表示しない。
- `loadCloudActivities()` は生の取得行を `cloudRows` に保持して `cloudRunCount=rows.length` としたうえで、`buildActivityFromCloudRow()` が地図描画候補を選別する。したがって保存一覧の件数と描画できる件数が違うことは設計上ありうる。
- `buildActivityFromCloudRow()` は原則route配列2点以上（例外的にGarminインドア空配列を許容）を基準にし、座標を数値化・有限値判定する。ただしここでは緯度±90・経度±180の範囲チェックが見当たらないため、A-4は追加の境界検証を必要とする。
- `renderCloudRowsList()` は `started_at || activity_date` の文字列ソートを使う。A-4の「初めて」の判定はこれをそのまま流用せず、**started_atが正常な時刻として解釈できること**を確認して昇順にする。日時欠損時にactivity_dateで代用しない。
- `renderCloudRuns()` は同じ `fetchCloudRuns()` から一覧を作る。A-4がこの集合を参照すれば保存一覧との件数の差を避けられるが、過去ラン追加・同時操作でのスナップショット整合性は別途検証する。
- 既存コードの `fetchCloudRuns()` を変更することなく既存の `cloudRows` を参照する案を第1候補とする。ただしロード済み状態やログイン切替・キャッシュ・更新タイミングの回帰確認が必須。

### 実装開始前の未解決ゲート（更新）
1. Run／Trail Run／Virtual Runの種目が `runs` でどう区別され、どの取り込み経路で保証されるか（現行取得列には無い）。
2. 各ソースのGPS有効判定と緯度経度範囲、開始日時の欠損率の仕様を確定。
3. UI導線から呼び出す際、本人の最新 `cloudRows` の全件取得完了が確認できること。
4. 最小判定ロジックの合成試験が通ってからページへ統合し、むせの監査・運営者承認を受けること。

**結論：既存の全件ページングと表示データ経路は確認済み。活動種目の保証が未確定なので製品の達成判定実装はまだ保留。**


## 追加調査：本番runs物理スキーマ（読み取り専用、2026-11-05）
Supabaseで `information_schema.columns` を直接照合し、`public.runs` に次の列があることを確認した：
`id(bigint)`、`created_at(timestamptz)`、`activity_date(date)`、`name(text)`、`distance_km(double precision)`、`route(jsonb)`、`user_id(uuid)`、`strava_id(bigint)`、`source(text)`、`started_at(timestamptz)`、`source_external_id(text)`、`deleted_at(timestamptz)`。
**活動種別を直接保持する列は存在しない。** 活動種目を判定せず、距離30km以上のすべての記録を「ラン」とみなしてはいけない。今回はスキーマ取得だけで個別ユーザー記録は読み取っていない。

## 分離した計算エンジン（未公開）
- PR #27の別ブランチに `a4-milestones-core.js` と `scripts/test-a4-milestones.cjs` を追加。
- 計算は外部から **ラン種目と確認済みであることを判定する関数** を必須とし、任意の `runs` 行だけではマイルストーンを認定できない設計。誤った常時trueの検証関数は製品へ組み込まない。
- 閾値30.000km、GPS座標の有限値と緯度経度範囲、日時欠損、削除済み、同時刻のruns主キー順について合成ケースを用意。**テストスクリプトの実行成功は未確認**。
- 製品UI、データ取得、同期処理、本番DB、main、一般公開への変更は一切ない。PRはドラフトのまま。

**未解決の重要事項**：ランニング以外の種目を現行runsへ保存しないことが、各ソースの取り込み処理と実際の本番構成で保証されているか。保証できなければ、種目の履歴メタデータや既存の取り込み仕様を再検討し、むせに設計判断を依頼する。活動種別の保証が得られるまでUIへの接続・マージ・本番公開を行わない。


## 取り込み元別の種目制限の追加確認（2026-11-05）
- **Strava**：`cycle/README.md` に本番 `strava-sync v46` が `Run/TrailRun/VirtualRun` に限定されるとの過去の実コード確認記録がある。ただし現行デプロイ済み関数の再取得は未実施。
- **Garmin Connect Activity Push**：`supabase/functions/garmin-activity-push/index.ts` の `allowedKinds` は `RUNNING`, `INDOOR_RUNNING`, `OBSTACLE_RUN`, `STREET_RUNNING`, `TRACK_RUNNING`, `TRAIL_RUNNING`, `TREADMILL_RUNNING`, `ULTRA_RUN`, `VIRTUAL_RUN` に限定。ラン系だが初期仕様の3種より広い。GPSなしのインドアはA-4第1弾の対象外。
- **FIT / COROS FIT**：`fit_importer.js` は `session.sport !== 'running'` を拒否し、ZIP検査でも `isRunning && hasGPS` を確認する。
- **TCX**：`index.html` のTCXパーサーはSportが明示されていてrunning以外なら拒否するが、**Sport属性が空欄／欠落の場合は拒否しない**。そのため保存済みのTCX記録すべてを種目確認済みとみなせない。
- **GPX**：`index.html` は汎用GPSルートを読み込むため、ファイルの内容がランニングであったことを厳格に証明する種目欄が無い。
- **Intervals.icu、Garmin Connect IQ、その他取り込み**：全取り込み元について本番の種目選別を実証できたわけではない。DBに活動種目列が無いので、後から単一行の `source` だけを見ても種目の証明にはならない。

**判定**：取得経路は確認できたが、現行 `runs` 全件が確実にランニングであるという証明はできない。A-4第1弾のUIを `verifiedRun: true` の一律設定で接続してはいけない。記録の出所と選別を安全に証明できる集合に絞るか、種目保証に関する設計をむせに再監査依頼する。既存取り込みやDBスキーマを変更しない。

## 合成テスト（ローカルNode実行）
`a4-milestones-core.js` と `scripts/test-a4-milestones.cjs` のGitHub掲載内容に対応するソースをローカルへ再現し、`node --check` とテスト実行で **A-4 prototype tests passed** を確認。ファイルの直接ダウンロードは実行環境のDNS制限で失敗したため、GitHubにあるファイルのバイト一致を保証した試験ではない。条件の境界・日付・GPS・削除・検証関数必須は通過したが、本番取り込みの種目保証やUI連携は未検証。
