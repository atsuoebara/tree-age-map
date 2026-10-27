# 公開確認 — 2026-10-27

- 実装コミット: 6619ac9b0f336b33ad591b8ceb009ce9287f0603
- 公開URL: https://runnersrings.com/cycle/
- GitHub Pages deployment: https://github.com/atsuoebara/tree-age-map/actions/runs/40462049133 — completed / success
- 既存ファイルの差分なし。追加範囲はcycle/のみ。CNAMEとSupabaseは変更なし。

## 成功した確認

- core.js / app.js のJavaScript構文検査
- core.test.cjs の10項目（距離、セグメント間の非連結、重複、別日、種目・座標・時間の検証）
- 公開ページの見出し、地図、取り込み、共通Journalリンクの表示
- 架空のGPX（0,0 → 0,0.01、10分）を公開ページで取り込み: 1件、1.11km、1日、10分
- 再読み込み後も同じ記録を表示
- ママチャリ絞り込みで対象なし、解除するとロードバイクの記録を再表示
- バックアップJSONを書き出し、ダウンロード先を確認
- スマートフォン幅390pxで表示を確認。コンテンツ幅375px、スクロール幅375pxで横はみ出しなし

## 検証の限界

- バックアップ復元のブラウザー通し検証、容量不足、実際のスマートフォン端末での操作は未確認
- 自動GPS記録・クラウド・Strava自転車同期は未実装
- 既存 check-index.js は変更前の状態で「選択ランの青線設定」2項目が失敗。
  この変更では既存index.htmlを編集していない。
- 希望サブドメインは未設定。READMEの別リポジトリ・Pages・DNS設定が必要。
- Supabaseのプロジェクト稼働状態と既存構成は確認。請求プランやStravaアプリ承認状態は未確認。

検証用ブラウザーには架空のQA記録が1件ある。公開サーバーやSupabaseへは保存されない。
