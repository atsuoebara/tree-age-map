# Rings Now: 方式Aの通信先・プライバシー・費用・旧タブ証拠ゲート（採用未決定）
2026-11-14 — PR #132 review-only

## 目的
一般ランナー向けRings Nowを最終目標とする。PR #131の架空契約を実HTTPに接続せず、導入前に必要な証拠を列挙する。これは採用の意思決定でも安全証明でもない。

## 導入前の12証拠
1. endpointDocumented: 接続先・運用主体・規約
2. requestMetadataReviewed: 本文のほかURL、ヘッダー、User-Agent、IP、Refererを監査
3. ipAndAccessLogsReviewed: CDN・ホスト・アクセスログの実態確認
4. retentionReviewed: ログ保存期間と削除・閲覧権限
5. cookiesAndReferrerReviewed: Cookie、追跡ID、リファラー
6. tlsAndCacheReviewed: TLS、HTTP/CDN/SWキャッシュ、改ざん・古い応答
7. freeTierReviewed: 無料枠の条件、改定・超過時の挙動
8. hardCostCapVerified: 予期しない利用量でも追加請求が出ない仕組みの実証
9. abuseAndRateLimitReviewed: 無認証の濫用・制限・停止手段
10. offlineFailClosedReviewed: オフライン・タイムアウト・検証不能時の遮断
11. oldTabLimitDocumented: 照会しない既存旧タブには停止を強制できないこと
12. iphoneSafariVerified: iPhone Safari、復帰、bfcache、スリープ、複数タブ

## 比較・判定の限界
12項目は未充足ならblocked。仮にすべてtrueと**自己申告**しても、外部の実証やむせの独立監査が必要な状態止まり。通信・プライバシー・0円・旧タブ全停止・実FIT・本番・方式A採用の許可フラグはすべてfalse。新規エンドポイント、料金プラン、通信の実行、FIT/ID送信は一切なし。何も運用契約やインフラ料金を確認していないため追加費用0円を証明していない。

## 開発の境界
新規4ファイルのみ。index、sw.js、公開HTML、DB、カレンダー、解析エンジン、本番フラグは不変。実FIT未承認、Rings Now本番OFF、PR #109 HOLD。採用A/B/C未決定。むせの独立監査と本人の明示承認前のマージは禁止。
