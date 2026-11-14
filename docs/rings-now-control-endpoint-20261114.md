# Rings Now / Supabase 制御エンドポイント骨組み — PR #135（DRAFT）
2026-11-14 / 方式Aを開発方針として本人承認済み。ただし通信・実FIT・本番公開は各々未承認。

## 実装
- 既存Supabaseの Edge Functions 配備形式を想定した未配備ソース
- POST JSON のみ。要求 `{protocol:"rings-now-review-v1",build:"v1"}` 以外を 400 で遮断
- body上限128バイト。許可リスト外のFIT、GPS、ID、心拍、メール等は応答に反映しない
- 受信内容にかかわらず、返答は `{protocol:"rings-now-review-v1",build:"v1",enabled:false}`。200、400、405、415でも許可は絶対に返さない
- Cache-Control no-store、Pragma no-cache、Expires:0、nosniff
- CORSを許可していない（ブラウザ側から本番接続可能にする段階ではない）
- DB/Storage/外部通信/ログ保存を呼ばない。Supabase管理基盤が保持するHTTPメタデータ・アクセスログは別監査が必要

## 次に必要な実証
1. 方式Aの採用と、実通信・公開・実FITの許可は別。現在は方式Aの開発方針だけ承認済み
2. 制御シグナルの真正性、配信先のアクセス権、CORS/preflight、キャッシュ失効、旧タブ/オフラインの境界
3. Edge Functionsのメタデータ（IP/User-Agent/リファラー）とログ保持・アクセス権の監査
4. Spend Cap ONの監査結果（2026-11-14）を維持し、追加費用ゼロを監視。使用量は月2699/200万の実測だが、将来負荷保証ではない
5. 実機Safariのネットワーク遮断と復帰動作、独立監査と本人による3つの承認
6. PR #134（合成カレンダー操作）は独立監査待ち。実カレンダー結線はこのPRに含めない

## 境界
今回は未配備コード・テスト・ドキュメント・CIだけ。実HTTPは発生させない。Supabase Function新設なし、Secrets/契約/DB変更なし。index.html、sw.js、既存公開HTML、FITデコーダ、カレンダーは無変更。Rings Now本番OFF、実FIT未承認、PR #109 HOLD。独立監査と本人のマージ承認までmainに反映しない。
