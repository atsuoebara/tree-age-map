# 本人提供FITだけの隔離分析設計ゲート（Strava回答待ち）

2026-11-13 / Draft PR #67 / **本番No-Go**

## 問い合わせの事実と判定
- Stravaに2026 API Policy §5.4の分析・結合と既存ルート長期保存について問い合わせ済み。
- 2026-11-13に **Strava Developers Ticket #19691** と自動返信が届いた。Developer Community Hub、FAQ、webhook/auth文書の案内のみであり、具体的な「本人限定1km分析の許可」「本人提供FITとStravaの照合の許可」「年輪の長期保存」への回答**なし**。これは承認や許可を意味しない。
- Garminの古い接続を解除するDELETEの作用範囲についても回答未確認。
- Strava streams取得・分析・他ソースとの結合・追加データ保存は引き続き **No-Go**。

## 本人提供FITだけを独立検討する理由
- GarminとCOROSなどのFITは、本人がファイルとして直接提供する選択肢を持つ。このファイルだけを使った分析は、Strava APIのデータを取得・計算・混合する処理とは区別できる。
- **注意**：この区別から「Stravaの表示と組み合わせてよい」「FITファイルの分析は全て無条件で合法」とは推論しない。ファイルの権利、同意、本人所有性、端末ローカル処理/保存方法、他データとの一致判定・画面表示は今後審査が必要。
- **現行 `fit_importer.js` は session.sport=running を要求し、GPSを用いてルート・走行距離を取り込む。今回のFIT時系列抽出・レース分析そのものは実装済みではない**。

## 今回追加した隔離コード
- `src/race-user-fit-only-gate.mjs`：合成標本の純粋な入口検査。出所は`user_uploaded_fit`のみに限定。本人がファイルを提供した確認・本人限定画面・ランニング種別を要求する。累積距離と経過時刻、順序、不正数値、心拍/ピッチ/パワーの欠損を検証する。入力元がStravaやGarmin APIなら拒否する。
- `tests/race-user-fit-only-gate.test.mjs`：欠損センサー、異種目、未同意、同一経過時刻・距離逆行、ゼロ進行、0Wを妥当な観測値として扱うこと、出所の分離を検証。
- これは単なる`offline_shape_review`まで。**analysisAllowed=false、writeAllowed=false、providerDataCombined=false**を維持。FITファイルの読み込み、1kmラップ演算、本人保存ランとの照合、添付、重複保存防止、表示やDB保存、API送信は行わない。データは全て合成。
- 取り込んだStravaランをカレンダー正本にする構想は保留し、**Stravaから取得した開始時刻・距離をFITと比較して同一人物/同一アクティビティを確定する実処理は許可しない**。

## テスト結果
GitHub Actions #43353665865、`Verify user-provided FIT-only offline shape and provenance boundaries` **success**、ジョブもsuccess。

## 本番Go/No-Go
1. Strava Ticket #19691から§5.4・年輪保存・混合表示について明示的回答を得る。
2. FIT標本の正確な解析・サンプル品質・自動停止・欠測・プライバシー・削除、FITファイル利用同意について個別の設計監査。
3. ランリングの既存runs・年輪と結合するなら独立した出所/同一性/同意/保存期間の仕様を新設する。
4. むせによる独立監査、オーナー最終承認を得るまで本番ファイル・DB・API・実ユーザーデータには触れない。

PR #67 Draft、PR #68 HOLD。本番変更ゼロ。
