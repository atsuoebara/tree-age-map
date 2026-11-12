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
