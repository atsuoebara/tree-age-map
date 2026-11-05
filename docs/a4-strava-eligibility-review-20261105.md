# A-4 第2弾：Stravaを「年輪の節」初30kmの対象に加える監査依頼

日付：2026-11-05。状態：**開発ブランチの試作／未マージ・未公開**。

## 本番ソースで直接確認した事実
- Supabaseの稼働中Edge Function `strava-sync` は **v46**、ACTIVE。
- v46の `runsToSave` は `activity.sport_type` を `Run` / `TrailRun` / `VirtualRun` に限定し、`activity.map?.summary_polyline` があるものを選別。
- 新規行は `source: "strava"`、`strava_id: activity.id`、`distance_km: activity.distance/1000`、`route: decodePolyline(...)`、`started_at: activity.start_date` を保存。
- **重要な注意**：既存のGarmin/GPX等と同じランだと照合できた場合、既存行の**距離とルートを保持したまま** `source="strava"` と `strava_id` を更新する。したがって `source="strava"` は必ずしもStrava由来の距離・ルートを意味しない。ただし同期対象のStrava活動自体はラン種目ゲートを通っている。
- 過去の取り込み版によるデータ来歴や、既存照合の許容誤差（同日・開始時刻5分以内・距離差最大0.5kmまたは8%等）を踏まえ、初30kmの閾値は**保存済み距離**で判定する。Strava原本の距離での初達成を断定しない。
- DBに種目列はない。最新の表示は `fetchCloudRuns()` の本人専用全件取得成功後にのみ計算。Strava APIの追加呼び出し・全履歴再同期・DB書き込みは行わない。

## このブランチの変更
1. `a4-milestones-core.js` に `verifiedImportedRun` を追加。`source="fit"` は従来どおり対象。`source="strava"` は正の `strava_id`（安全な整数または数字文字列）がある場合だけ対象。それ以外・未知sourceはすべて拒否。
2. `a4-milestones-preview.js` で上記の検証関数を使用。日英の注意書きをFIT + Strava対象に変更し、既存記録との紐付けでは元距離・ルートを使うことを開示。
3. `index.html` のA-4スクリプトだけキャッシュ版を更新。
4. `scripts/test-a4-milestones.cjs` にStrava IDあり／なし、他source除外、29.9995km、同一GPS点、削除済み、時刻欠損、過去ラン順序の試験を追加。

## 独立監査で特に判断してほしい点
- **最大の論点**：既存行にStravaを紐付けた際の保存距離を使って「初30km」と呼ぶことの妥当性。Stravaの正規距離とは異なる場合がある。限定注記で十分か、それとも追加の表示変更・対象制限が必要か。
- Strava IDがあるだけで必ず「ラン種目確認済み」と見なせるか（旧版同期・連携処理の全経路を再点検）。厳格なソース・ID判定の妥当性。
- 数字文字列 `strava_id` の有効条件、未知sourceの拒否、既存FIT機能の後方互換、GPS二点以上・30km厳密閾値の保持。
- 本人だけの全件取得とアカウント切替ガード、二重描画や表示切替、iPhone幅、日英文面。
- 保存済みランにまだ該当がない場合の未達表示は対象集合についてのみ言及していること。
- 本番の `strava-sync` のコードと実運用の一致。Edge Function自体を変更しないこと。

## 非対象と完了条件
DBスキーマ・同期API・既存データ・公開許諾・共有・ランキングを変更しない。追加費用0円。
この文書は監査依頼であって正式合格ではない。**むせの独立差分監査で安全条件が満たされるまでmainへマージしない**。マージ後のPages／本番一致、AtsuoのiPhone実機確認を経て正式完了とする。
