# Runner's Rings 更新ロードマップ（2026-09-26）

## 並行開発 A: Journal 2.0（優先：完成・公開）
- [x] GitHub ActionsのSupabase URL / Publishable key設定
- [x] Generate Journal article pages ワークフロー正常終了
- [ ] 0件生成の理由と記事抽出条件をコード・テストデータで検証（テスト記事は公開しない）
- [ ] 下書き専用の安全なプレビュー生成経路を実装
- [ ] 画像・記事表示・共有・スマホ表示を検証
- [ ] 公開可能な記事が準備できた段階で本番公開

## 並行開発 B: Rings Ranking（独立ページ）
- [x] ranking.html UI試作を作成（本番index.html未変更）
- [x] 任意参加・初期OFF・国の自己申告という画面方針を反映
- [x] 3部門を確定：DISTANCE（世界個人年間距離） / EXPLORE（実際に走った国ごとの年間走破地域数） / NATIONS（所属国別年間合計距離）
- [x] 3部門それぞれ独立参加・初期OFFを確定
- [ ] 同率処理・細かな集計境界ルールを確定
- [ ] EXPLORE対応国を既存行政境界データに合わせて順次追加
- [ ] NATIONSの所属国選択肢を世界各国へ拡張
- [ ] 日本語/英語表示の完全分離を検証
- [ ] Supabaseの参加設定テーブル、RLS、参加取り消し・公開範囲設計
- [ ] 集計APIの実装、実データ接続、負荷・プライバシー試験
- [ ] テスト後にindex.htmlからranking.htmlへのリンクを追加

## EXPLORE Coverage 管理ツール（運営用・Rankingとは別ページ）
- [ ] 取込ランのGPSから「EXPLORE未対応国での走行」を国単位で自動検出
- [ ] 個人の位置情報を公開せず、未対応国ごとの走行人数・RUN数を管理側で集計
- [ ] 「走行発見 → 対応候補登録 → 行政区分確認 → 境界データ追加 → EXPLORE対応ON」の運用フローを実装
- [ ] 未対応国を自動公開・自動対応にはしない（管理者確認を必須とする）
- [ ] ranking.htmlにはEXPLORE対応完了国だけを表示
- [ ] 一般ユーザー向けranking.htmlと分離した非公開の管理ページ/ツールとして実装

## 安定化・運用
- [ ] 地図の面表示・戻る・ズーム不具合
- [ ] SteveのStrava 53件停止原因を非公開設定のまま検証
- [ ] Garmin Connect IQ送信・審査
- [ ] AdSense / Adsterraの確認と改善

## 次の実作業
1. Journalの生成コードと記事取得条件を確認し、非公開のままテストできる修正を作る。
2. ranking.html第3版で日本語/英語の完全分離とEXPLORE対応国の順次追加方針を確認する（本番index.htmlは触らない）。
3. JournalとRankingを並行して進め、Rankingは同率処理・DB/RLS設計へ進む。
