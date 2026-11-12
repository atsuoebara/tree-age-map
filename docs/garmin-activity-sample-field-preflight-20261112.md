# Garmin Activity Details サンプル項目の受信前検証（2026-11-12）

状態：**read-only調査と設計ゲートのみ**。Runner's Rings の実受信データはまだ確認していない。ユーザーデータへのアクセス・DB変更・本番関数の変更なし。対象はPR #67（Draft）。

## ソースの区別
1. **Garmin公式（現在公開の概要）**: Activity API は活動詳細のJSON/ FITデータを提供し、Starter BusinessではActivity APIのJSON/FITとPush方式が利用対象。Enterprise限定の機能をStarterで利用できると仮定しない。公式概要 https://developer.garmin.com/gc-developer-program/overview/ 、公式Activity API https://developer.garmin.com/gc-developer-program/enterprise/activity-api/ 。これはRunner's Rings の現アカウントがStarter経由で各サンプル項目を受信済みである証明ではない。
2. **公開されている旧Activity API仕様の転載（Garmin公式の現行検証ではない）**: sampleに `startTimeInSeconds`, `totalDistanceInMeters`, `heartrate`（全小文字）, `stepsPerMinute` などのフィールドが示される。 https://www.scribd.com/document/794184899/Garmin-Developer-Program-Activity-API  。**注意：心拍フィールド名が既存隔離抽出コード `heartRate`（大文字R）と異なる**。実仕様・実データ未確認のため、転載の表記だけを正としてコード変更しない。
3. **GitHub main確認**：`supabase/functions/garmin-activity-push/index.ts` の `sanitized()` は現在 `samples` の緯度・経度だけホワイトリスト化し、時刻/累積距離/心拍を破棄。従って受信inboxを読んでも残存フィールドからは検証できない。`garmin_commit_activity` で受信inbox payloadは消去される。
4. **Draft PR #67確認**：`supabase/functions/_shared/garmin_race_optional.ts` は `startTimeInSeconds` と `totalDistanceInMeters` を必須、`heartRate` を任意として抽出する。既存合成テスト/フィクスチャで`heartRate`を使っていても、Garminからの本番raw payloadを証明しない。
5. **既存FIT SDK**：`fit_importer.js` は端末内で FIT の `sessionMesgs` と `recordMesgs` を読み取るが、現在の取り込みロジックは主に位置GPSを使う。FITの`recordMesgs`の時刻/距離/心拍が解析に利用できるかは別検証（Garmin自動Pushのデータ形式と混同しない）。

## 確認済み / 未確認のゲート
| 項目 | 判定 |
| --- | --- |
| Garmin Activity API自体のJSON/FIT詳細提供 | 公開の公式説明で確認 |
| Starterアプリに必要サンプル全種が届くか | **未確認** |
| `samples[].startTimeInSeconds` 実受信の有無 | **未確認** |
| `samples[].totalDistanceInMeters` 実受信の有無 | **未確認** |
| `samples[].heartrate` vs `heartRate` の正規の表記 | **未確認・実装不一致の懸念** |
| 同一活動内でサンプル時刻と活動start/endの整合 | **未確認** |
| Garmin Activity Detailsの受信フォーマット、送信サイズ、点数の分布 | **未確認** |
| 本番DBのruns列（created_at等）・inbox列・権限 | SQL候補は読めるが**実スキーマ未照合** |
| 追加費用0円 / 大会級長距離のサンプル保持量 | **未検証** |

## 走らずに先にできる検証
1. Garmin Connect Developer Portalで**現Starterアプリに適用される公式Activity Details JSONスキーマまたはサンプルデータ**が表示・入手可能か、契約と権限の範囲で確認する。アクセス不可なら不可と報告し、無理に実受信できると断定しない。
2. 上記公式サンプル（個人情報のないもの）で必須の時刻/距離フィールド、心拍の正規名、サンプル間隔、時刻値の基準、値が0/欠測の場合を照合する。サンプルデータ由来を記録し、既存合成データと明確に分ける。
3. 初期段階では公開APIの非契約経路やユーザーアカウントの勝手な取得を行わず、契約/提供仕様を優先。未確定なら非公開の本人同意済み試験計画を別途承認後に実施する。
4. 実サンプル確認後に初めて `sanitized()` の許可フィールドと変換、保存上限、型・範囲・サイズ、元Garmin活動IDとの紐付け、Garminデータ表示時の出典表記を設計してむせに監査を依頼する。
5. 未確認を理由に既存のGarmin受信や年輪保存を書き換えない。ユーザーに新たな実走を要求しない。

## Go/No-Go
**現時点：保存経路の実装Go不可。** 理由：実フィールド・現Starter仕様と正規の心拍キー、実データサイズの検証が不足。これを満たせば、前回のC1〜C5監査条件に沿って「年輪を壊さない最小追加データ保管」へ進む。

Garmin API表示・二次配布等は公式規約に従う。解析結果画像を共有する場合のGarmin出典表示要件も別途確認する。

## 2026-11-12 Next：公式公開ページ・既存テストの再照合結果

### 一次情報の実確認
- Garmin公式 Activity API ページ https://developer.garmin.com/gc-developer-program/enterprise/activity-api/ は、活動詳細とJSON summary/FIT提供、Push/Ping/Pullを説明する。**公開ページには`samples[].startTimeInSeconds`, `totalDistanceInMeters`, `heartrate`/ `heartRate`のJSONキーの正規形は載っていない**。URLはenterprise分類なので、Starterの現在の提供フィールドを証明する文献とは扱わない。
- Garmin公式プログラム概要 https://developer.garmin.com/gc-developer-program/overview/ もAPIの範囲を説明するが、フィールド仕様は公開せず、Developer Programの実際のアプリ権限との照合が別途必要。
- Garmin公式 FIT activity specification https://developer.garmin.com/fit/articles/file-types/activity.html はFIT内のRecord/HR情報の仕様。**FIT形式の項目名とActivity Details JSON Pushのキー名は同一と仮定できない**。
- Garmin Personal APIの公開Swaggerには活動ファイルdownload endpointがある（https://developer.garmin.com/gc-developer-program/personal/swagger-docs/）。ただし**そのPersonal APIをRunner's Ringsの既存Garmin接続資格情報で利用できることは確認できない**。非契約APIや非公式Connect endpointに切り替えない。

### 既存リポジトリの追加証拠
- `scripts/test-garmin-push.mjs` は `heartRate:140` を含む**人工的な**sampleを入力としているが、`sanitized(detail)`から`heartRate`が消えることを**明示的に確認するテスト**がある。このテストは実際のGarmin受信ペイロードを再現したものではない。
- `src/race-source-continuity-diagnostic.cjs` などの合成サンプルは`totalDistanceInMeters`と`startTimeInSeconds`を使用するが、Garmin現行APIの実受信証拠にはならない。
- つまり、**公式公開資料・既存リポジトリだけからPushでの必須2項目とHRの正規キーを確証することはできない**。心拍名を`heartrate`へ変更したり`heartRate`との二重読みを本番側に追加したりするのは時期尚早。

### 実装可能性への影響と次の最小ゲート
1. 現アプリにアクセス権のあるGarmin Developer Portalの公式API仕様・匿名のサンプルActivity Detailsを取得できるか確認。**現状この経路での非公開資料へのアクセス許可・内容は未確認**。
2. そのサンプルが本番と同じactivityDetails payload schemaであることを確認し、timestamp/cumulativeDistance/heartRateの正しいキー・型、サンプル間隔、最大サンプル数、GPS欠測の扱い、summaryとsample開始時刻の整合を確認。
3. 最小ホワイトリスト拡張時に`scripts/test-garmin-push.mjs`の「heartRateを落とす」現行不変テストを**適切に見直す必要がある**。テストを黙って消さず、許可した新規フィールドだけ残り、token/余分なsensor/個人情報は引き続き破棄されることを明文化。受信のGPS routeは不変。
4. 公式匿名サンプルが入手できない場合、**実走を直ちに要求せず**、本人の明示承認・権限/個人情報の取り扱い・保存期間を限定したサーバ受信検証を別案として監査。現行受信コードとDBは変更せず、実データを無断で取得しない。
5. Garminサンプルフィールドが取得不能なら、公式FITを端末内で分析する代替案を選ぶ。この場合の「Garmin由来の真正性」や「8日ゲートの強制」はサーバ方式と同等とは言わない。

**更新後判定：自動受信の本番保存経路は依然No-Go。** 必要サンプルの実受信と権限、データ形式が未確認。これはコーディング不足ではなく、次段に進む前に潰すべき外部仕様依存である。
