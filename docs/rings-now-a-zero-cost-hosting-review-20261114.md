# PR #133 Rings Now 方式A — 追加費用0円の配信候補比較（採用未決定）
2026-11-14 / isolated review, no infrastructure provisioning

## 背景と目的
一般ランナーにRings Nowを使ってもらうことが最終目的。PR #131の匿名制御契約、PR #132の12証拠ゲートを前提に、静的配信と無料枠のある制御エンドポイントの差を整理する。本PRは構成案と合成テストのみ。実際の通信を一切行わない。

## 候補（2026-11-14に確認した公式資料）
- GitHub Pages: 既存サイトの静的配信。サーバー側コードは実行できないため、古いJavaScriptがキャッシュした許可を常に破棄する保証はない。静的JSONを更新しても旧タブが再取得しなければ撤回に気づかない。https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- Cloudflare Workers Free: 公式資料上100,000リクエスト/日、CPU 10ms/リクエストなどの無料枠がある。ただしアカウント契約、無料枠超過時の挙動、ホスト名・ログ・IP・キャッシュ・運用・最新規約と、追加請求なしの保証は未確認。特に無料枠の上限超過時、Workerの処理を迂回する fail-open 設定では安全停止を保証できない。実際の設定が fail-closed である証拠を別途要求する。Workersを新設・接続していない。https://developers.cloudflare.com/workers/platform/limits/
- Supabase Edge Functions: 公式価格ではFreeが月50万呼び出し、Proは月200万まで込みで超過課金あり。FreeとProの実費・超過挙動が異なる。既存プロジェクトのプランや実際の利用量・料金設定を調べていない。追加費用0円かは未確認。新しいFunctionやDB変更はない。https://supabase.com/pricing および https://supabase.com/docs/guides/platform/billing-on-supabase

## 比較結論（推奨・採用ではない）
GitHub Pages単独ではリアルタイムの強制撤回サービスにならない。Workers/Supabase等を使う設計は検討可能だが、無料枠を見ただけで0円確約とはしない。実HTTPの送信では、契約がFITやIDを含まなくてもIP・User-Agent・ヘッダー・アクセスログが生じ得る。生のFIT、GPS、心拍、メール等を外部へ送らないという条件は引き続き必須。
いずれの候補も、すでに開いて照会機能を持たない旧タブを強制停止できない。iPhone Safariのスリープ、復帰、bfcache、サービスワーカー、CDN、通信失敗時の遮断は実証されていない。

## 監査観察への対応
Workers候補だけは `workersOverageFailClosedVerified=true` の自己申告を追加で要求する。未指定・false・文字列trueは遮断。未知の追加項目も遮断し、PR #132の厳密な入力方針にそろえる。すべて満たしても自己申告であり、独立外部検証は未完了。実際のWorkers設定や課金条件を変更・確認したものではない。

## 未確認証拠
1. 実際の既存Supabase契約・料金プラン・制限、既存処理への影響
2. Workersを使う場合のアカウント作成・課金設定・追加請求が絶対に発生しない制限
3. 本文以外の通信メタデータ、IP・ログ保持、CDN・Cookie・Referer
4. レスポンス鮮度・認証とリプレイ、キャッシュ不正、停止時のfail-closed
5. 実機Safariでの複数タブ、オフライン、bfcache、スリープからの復帰
6. 大量アクセス・レート制限・障害対応と本番切替前の明示承認

## 範囲とゲート
新規4ファイル（合成判断モデル、テスト、文書、CI）だけ。すべてtrueの自己申告でも独立した外部検証が残り、許可は出ない。Rings Now本番OFF、PR #109 HOLD、実FIT未使用・未承認、方式A/B/C未採用。index、sw.js、公開HTML、DB、カレンダー、解析エンジン、既存の料金プラン・通信先を一切変更しない。むせ独立監査＋本人明示承認前のマージは禁止。
