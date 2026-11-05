# PR #40フォローアップ：iPhoneの機能カード段差修正 独立監査依頼（2026-11-05）

## 実機で見つかった問題
PR #40のCSSコンパクト化を本番配信後、iPhone実機画面で次のバランス崩れを確認：
- Rings Journal と Rings Ranking のカードが別々の高さになり、下辺が揃わない
- Rings Territory と Rings Today のカードも下辺が揃わない
- 行ごとに不揃いの余白が生じ、視覚的なまとまりが失われた

**原因**：幅600px以下の `#dashboard .rrFeatureTiles { align-items:start; }` および `.dashboardFeatureGroup { align-self:start; }` によりCSS Gridの行ストレッチが解除された。テキスト量の異なる左右カードが内容高のまま描画された。長文のRanking/Territoryだけが高くなった。

## 修正
`index.html` の幅600px以下メディアクエリの**2つの宣言のみ変更**：
1. `#dashboard .rrFeatureTiles` の `align-items:start` → `align-items:stretch`
2. `#dashboard .rrFeatureTiles > .dashboardFeatureGroup` の `align-self:start` → `align-self:stretch`

これにより同じCSS Grid行の左右のカードが行の高さまで広がる。Rings Ranking/Territory等のグループ型カードと、Journal/Today等の単独リンク型カードで下辺が一致する想定。
- 文字やタップ操作は折り返し、コンパクトなgap 8px・余白設定は維持
- 44pxのタップ領域、iPhone狭幅350px以下の一列ルールを変更しない
- Today重複防止、A-4年輪、ランデータ、認証、英語切替等のJavaScript・DBは変更なし
- 画面の高さや固定ピクセル指定による文字の切断は追加しない

## 監査で確認すること
1. PR #40での段差の根本原因がGridのstart配置であること
2. 2宣言だけの変更で、別の余白・スクロール・機能退行を生まないこと
3. 日本語・英語の文字量に応じて左右カードの下辺が揃うこと
4. 320〜430pxでの1列／2列切替、GPS Art全幅カード、People/Toolsの高さが安定すること
5. ログイン前画面には影響がないこと
6. 既存のToday 1枚・A-4・月間/前年カード・44pxタップ領域を維持すること
7. mainへのマージ可否。本番配信監査とiPhone実機チェックは別途

**現時点ではPR #40のiPhone最終承認は未完了。本修正の実機OKをもって再判定する。**
監査のみ。コード変更、マージ、デプロイ、DB変更なし。
