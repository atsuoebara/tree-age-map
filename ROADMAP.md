# Runner's Rings 更新ロードマップ（2026-10-02）

> GitHub上の本ファイルを進捗の唯一の正本とする。
> 完了済み事項を理由なく未完了へ戻さない。
> 開発再開時は本ファイルと現行ファイルを確認してから着手する。

## 確定した開発優先順位

1. Rings Territory 海外編
2. 細かな修正・安定化
3. Garmin Connect IQ の実機送信・審査
4. キャラクターデザインの保管・再利用

AdSense / SEO / SNS運用は別枠で並行する。

---

## A. Journal 2.0

### 完了
- [x] `journal.html` を正式一覧として運用
- [x] Supabase `journal_posts` と Storage `journal-images/posts` を使用
- [x] 旧記事＋新Journalを統合
- [x] URLコピー / X / スマホ標準共有
- [x] GitHub Actionsによる自動生成
- [x] Steveへの感謝記事掲載
- [x] Google Search ConsoleでJournal記事のインデックス確認

> Journal 2.0は完成扱い。不具合が発見されない限り未完成へ戻さない。

---

## B. Rings Ranking

### 実装・運用中
- [x] `ranking.html` 独立ページ
- [x] DISTANCE：世界個人・年間走行距離
- [x] EXPLORE：実走国ごとの年間走破地域数
- [x] NATIONS：自己申告所属国ごとの年間合計距離
- [x] 3部門それぞれ独立参加・初期OFF
- [x] 自己申告国 / 国旗 / 地域名公開設定
- [x] ログイン不要閲覧
- [x] `index.html` にRanking導線
- [x] ログイン前後のJournal / Ranking導線を強調
- [x] EXPLORE未対応国検出Workflowを毎日自動実行
- [x] 年フィルタを追加
- [x] 現在の参加設定を過去年にも適用
- [x] 参加者の保存済みランが存在する年を現在年から過去へ自動表示
- [x] EXPLORE反映待ちの注意書きを追加

### 継続確認
- [ ] 海外実ユーザーでの利用状況を継続確認
- [ ] 同率・重複等の細かな集計ルールを必要に応じて調整
- [ ] 公開範囲 / RLS / 集計負荷を継続監視

---

## C. EXPLORE未対応国 自動検出

### 完了
- [x] `explore-coverage-discovery.yml`
- [x] `scripts/detect-explore-coverage.mjs`
- [x] 毎日 UTC 0:00（日本時間 原則9:00）に自動実行
- [x] DBへの書込みなし
- [x] `explore-coverage-private-report` Artifact保存
- [x] 未対応国検出時にGitHub Issueを自動作成
- [x] 2026-10-01の直近実行：未対応国0件

> 稼働済み。問題報告がない限り再開発扱いにしない。

---

## D. Growth Rings Timelapse

### 実装完了・継続QA
- [x] `Growth Rings Timelapse` の再生UIを `index.html` に実装
- [x] タイムラプス開始時の現在の地図中心位置を固定
- [x] タイムラプス開始時の現在のズーム倍率を固定
- [x] 自動で別地点や全体表示へ移動しない
- [x] `コース` 表示に対応
- [x] `面` 表示に対応
- [x] 開始年月 ～ 終了年月を選択
- [x] 月ごと / 年ごとの再生に対応
- [x] 最初は走行データ0の地図から開始
- [x] そこから走った道・面が時系列で積み上がる
- [x] 初期期間を現在年1月〜現在月に設定
- [x] Instagram縦投稿向け4:5（1080×1350）
- [x] Runner's Ringsロゴを常時表示
- [x] ピンク＋イエローのブランド枠
- [x] 最後に `Map the life you run.` を表示
- [x] iPhone SafariでMP4生成・プレビューを実機確認
- [x] コース表示をCanvas直接描画し、共有動画で実機確認
- [x] 下の地図で合わせた中心・縮尺を共有動画へ反映
- [x] 新規コースの発光演出を実装・実機確認
- [x] 新規「面」の発光演出を実装・実機確認
- [x] 冒頭黒画面を解消・実機確認

### 継続確認
- [ ] iPhone Safariの「共有」「保存」の最終確認
- [ ] Chrome等でWebM生成時の保存・共有挙動を確認

> 新規開発の主工程からは外し、今後は不具合・共有互換性を継続確認する。

---

## E. Rings Territory 日本版

### 完了
- [x] `territory.html` 独立ページ
- [x] 日本は市町村単位
- [x] 1/1〜12/31の年間集計
- [x] 市町村内の年間走行距離で首位判定
- [x] 参加は任意・初期OFF
- [x] 参加ONユーザーだけを集計・表示
- [x] 年フィルタは2026年開始
- [x] 現在年を初期表示し、2026年まで遡って閲覧可能
- [x] 2027年以降は現在年が自動で先頭に追加される
- [x] `territory-setup.sql` を実装
- [x] `scripts/sync-rings-territory.mjs` を実装
- [x] `Sync Rings Territory (Japan)` Workflowを実装
- [x] GPS区間中点を市町村へ割り当て、保存済み `distance_km` に合わせてスケール
- [x] 2026年実データを同期
- [x] 地図上で首位ランナーごとに色分け
- [x] 首位ランナーの色凡例
- [x] 市町村タップで上位3人＋年間距離を表示
- [x] 選択市町村をピンク枠で強調
- [x] 参加記録のある市町村へ自動フィット
- [x] `index.html` にRings Territory導線
- [x] ログイン前 / ログイン後の両方から閲覧可能
- [x] 初回表示で日本全体が一瞬見える問題を改善
- [x] 最終fit完了後に地図を表示する方式へ変更

### 継続確認
- [ ] 同率時の最終表示ルール
- [ ] Territory専用プロフィール公開範囲
- [ ] 集計負荷 / RLS / Workflow実行時間を継続監視

> 日本版MVPは完成扱い。今後の主工程は海外対応。

---

## F. Rings Territory 海外編【次の最優先】

### 目的
日本の市町村で実装したRings Territoryを、海外の行政区分にも拡張する。

「この街・地域を、その年にいちばん走ったのは誰か」を、
国ごとの行政区分に合わせて世界へ広げる。

### 確定方針
- [x] 日本版とは同じ `Rings Territory` ブランドで運用
- [x] 年間距離による首位判定を継続
- [x] 参加は任意・初期OFFを継続
- [x] 2026年開始を継続
- [x] GPS区間中点で行政区分へ距離を割り当てる基本方式を継続
- [x] 保存済み `distance_km` に合わせて距離をスケールする方式を継続
- [x] 日本は従来どおり市町村データを使用
- [x] 海外はRunner's Rings本体の `WORLD_ADMIN_CONFIG` を基準に国別ラベルを使用
- [x] 海外Territoryの基本単位は各国のADM2とする
- [x] 画面では「ADM2」とは表示せず、国別の自然な名称を表示する
- [x] 国切替を追加し、選択した国のTerritory地図を表示する
- [x] 国旗・国名は閲覧対象国を示す用途に使い、ユーザー国籍とは混同しない

### 現行コードに存在する海外行政区分候補
`WORLD_ADMIN_CONFIG` に現在登録されている国：

- USA：郡・独立市 / County / Independent City
- AUS：地方自治体 / Local Government Area
- CAN：国勢調査区分 / Census Division
- GBR：カウンティ・単一自治体 / County / Unitary Authority
- FRA：県 / Department
- DEU：行政管区 / Government District
- NZL：地方自治体 / Territorial Authority
- KOR：市・郡・区 / City / County / District
- KHM：郡・区・市 / District / Municipality
- THA：郡・区 / District
- VNM：県・区・市 / District / City
- SGP：計画区域 / Planning Area
- MYS：郡・地区 / District
- PHL：州 / Province
- IDN：県・市 / Regency / City

### 実装前に必ず確認すること
- [ ] `WORLD_ADMIN_CONFIG` と実ファイル名の整合性を確認
- [ ] `runners-rings-<country>-adm2.geojson` の命名へ統一するか、ファイル名マッピングを設ける
- [ ] `*-simplified.geojson` の国を現行ローダーで正しく読めるよう整理
- [ ] 各国ADM2の `shapeID` / `shapeName` をTerritoryの安定ID・表示名として使えるか検証
- [ ] 国境をまたぐ1ランを複数国へ正しく分配できることを確認
- [ ] 海外ランが存在する国だけを同期対象にする設計を検討
- [ ] USAの3,000超ADM2など、大規模GeoJSONでの同期時間・メモリ使用量を確認

### 推奨データモデル
日本専用の
`territory_run_municipality_distance`
をそのまま世界用に無理に拡張せず、海外対応時に汎用化を検討する。

候補：
- `territory_run_region_distance`
  - `user_id`
  - `run_id`
  - `activity_year`
  - `country_code`
  - `admin_level`
  - `region_code`
  - `region_name`
  - `parent_region_name`
  - `distance_km`
  - `updated_at`

日本を同テーブルへ移行するか、日本テーブルを維持してRPC側で統合するかは、
既存日本版を壊さない方を優先して決める。

### UI方針
- [ ] `territory.html` に国切替UIを追加
- [ ] 初期表示は日本
- [ ] 国選択後、その国の参加記録がある地域へ自動フィット
- [ ] 記録0件の国は国全体を表示
- [ ] 地図の色分け、首位ランナー色凡例、上位3人UIは日本版を流用
- [ ] 国ごとの行政区分名を `WORLD_ADMIN_CONFIG` から表示
- [ ] スマホで国選択が横に長くなりすぎないUIにする

### Stage 1
1. 海外Territory対象国とGeoJSONファイルの整合性チェック
2. 汎用海外集計テーブル / RPC設計
3. `sync-rings-territory.mjs` を世界対応できる構造へ分離
4. まず1か国で自己テスト
5. 実データで同期確認

### Stage 2
1. `territory.html` に国切替
2. 選択国GeoJSONの遅延読込
3. 海外首位データの色分け
4. 地域タップで上位3人表示
5. スマホ実機確認

### 最初の検証国
最初から全15か国を一気に有効化せず、
既存GeoJSONと実ランデータの両方を確認しやすい国から1か国ずつ検証する。

第一候補：
- KOR：ADM2が市・郡・区で、日本の市町村に近く構造を比較しやすい
- USA：実利用価値は高いが、ADM2が3,000超あるため負荷検証を先に行う

> 実装順は「KORで構造確認 → USAで大規模負荷確認 → 他国展開」を基本案とする。
> 実ユーザーの海外ランがある国を優先する場合は、その国を先にしてよい。

---

## G. 地図・安定化

### 完了
- [x] 走路タップ時の「この場所を走った記録」を最新20件＋20件ずつ追加表示
- [x] ポップアップ内スクロールで全履歴へアクセス可能
- [x] 2026-10-01 実機確認済み
- [x] GitHub Actions Success確認済み

### 継続監視
- [ ] Leafletの面 / コース再描画タイミング問題
- [ ] 海外地域別一覧など、実ユーザー報告があった不具合
- [ ] Garmin Connect IQの実機送信・審査

---

## H. Strava / 外部連携

### 完了・稼働
- [x] Strava Athlete Capacity 999
- [x] Overall 600/15分・6,000/日
- [x] Read 300/15分・3,000/日
- [x] 新規受付再開 `STRAVA_NEW_CONNECTIONS_PAUSED=false`
- [x] Intervals.icu連携
- [x] COROS連携
- [x] Garmin Connect IQ経由
- [x] FIT / GPX / TCX / ZIP取込

### 継続確認
- [ ] SteveのStrava 53件停止原因を必要に応じて検証
- [ ] Garmin Connect IQの広機種対応・審査

---

## I. SEO / AdSense / クローラー

- [x] `sitemap.xml` 稼働
- [x] `ranking.html` をsitemapへ掲載
- [x] Journal記事のGoogleインデックス確認
- [x] `robots.txt` を追加
- [x] `User-agent: * / Allow: /`
- [x] sitemap URLをrobots.txtへ明記
- [x] Search Console「検索の生成AI」は「含める」
- [ ] Gemini側の `URL_FETCH_STATUS_GOOGLE_EXTENDED_OPT_OUT` が反映後に解消するか確認
- [ ] AdSense再審査結果を確認
- [ ] AdSense承認後、操作を邪魔しない位置へ手動広告枠を配置

---

## 次の実作業

**Rings Territory 海外編 Stage 1：GeoJSON / 国設定の整合性確認から開始する。**

最初に行うこと：
1. `WORLD_ADMIN_CONFIG` の対象国一覧と実ファイルを照合
2. `*-simplified.geojson` を含むファイル命名の不一致を整理
3. 海外用の安定した `region_code` / `region_name` を決定
4. KORを最初の検証国として、現在の日本版集計ロジックを海外ADM2へ適用できるか自己テスト
5. 日本版を壊さないことを確認してからDB/RPCを追加する

---

### 2026-10-02 追記
- Rings Territory 日本版MVPを完成扱いへ更新。
- `index.html` にRings Territory導線を追加済み。
- Territory初回表示で日本全体が一瞬表示される問題を改善。
- 地図は参加記録のある地域へfit完了後に表示する方式へ変更し、実機で改善確認。
- 次の主要工程をRings Territory海外編へ変更。

### 2026-10-06 index周りの更新（実機確認待ち）
- [x] 公開3集計の下に国別走行距離の横スクロールチップを実装。
- [x] 距離あり国のみ・距離降順・API返却国の自動追加・日英表示に対応。
- [x] 国別集計は各ランの全距離をスタート地点の国へ割り当てる方式と明記。
- [x] Journalのブランド表示を `Rings Journal` に統一（記事生成スクリプトを含む）。
- [ ] `get_public_run_origins` の全件返却・削除除外・権限を確認。
- [ ] `import-share` の実レスポンスとスマホ表示を確認。

次の実作業は国別距離の実数・表示確認を優先し、その後に既存の海外編工程へ戻る。

### 2026-10-06 海外対応追加（公開・同期前）
- [x] 国別距離APIの実レスポンス200を確認。取得20610件、国判定20466件。スタート地点集計。
- [x] タイ・マレーシアをTerritoryの表示／同期設定に追加。
- [x] ソロモン諸島・ロシアのADM1/ADM2を追加し、本体・EXPLORE・Territoryに設定。
- [x] 本体の海外GeoJSON参照を実ファイル名に対応（simplifiedファイルを含む）。
- [x] 国旗のISO2変換に残っていた旧コードを修正。
- [x] 新規4か国の既知座標検証、EXPLORE境界ロード、index構文チェック。
- [ ] GitHub反映後、EXPLOREとTerritoryの集計を実行して実表示を確認。
- [ ] ケイマン諸島の再配布可能な地区データを取得して追加。
- [ ] スマホ表示を確認。

今回の置換ファイルは海外対応の変更分のみ。Journal記事の差し替えは不要。

### 2026-10-06 地図の中立性・領土問題の説明
- [x] FAQに日英の国・地域名／境界線／領土・領有権についての説明を追加。
- [x] 本体とTerritoryの地図付近に短い注記とFAQへのリンクを追加。
- [x] 地域走破・EXPLORE・Territory・国別距離がデータ上の判定であることを明記。
- [x] Territoryの色は実際の領土・所有権・支配を示さないことを明記。
- [x] 実機ログで追加4か国のTerritory同期成功、EXPLORE同期成功を確認。
- [ ] 注意書きの公開後、日英表示とリンクを実機確認。

引き継ぎ必須：今後の海外追加・地図データ更新でもこの注意書きを維持する。地図表示と統計の判定は政治的立場の表明として扱わない。境界データ変更時は集計への影響も確認する。

### 2026-10-06 Rings GPS Art 下地
- [x] 独立ページ `gps-art.html` の下地を作成。オレンジ×シアン、スマホ対応、日英切替。
- [x] 紹介・作品一覧の空状態・制作エリア・最下部の戻るボタンを配置。
- [x] 閲覧は未ログイン可、制作／生成はログイン必須という予定を表示。
- [ ] 生成エンジン、実道路へのルート化、ログイン認証、保存／投稿／公開、作品データ取得。
- [ ] 本体からの導線を追加（今回は独立ページのみ）。
- [ ] 公開後のスマホ・日英表示確認。
下地の図はイメージであり、実走可能な道路／ルートではない。入力・生成ボタンは無効。今後ログイン要件はUIだけでなくサーバー側でも検証する。未実装機能を完成扱いにしない。

### FAQ配置の実機確認
- [x] 領土問題の説明と地図の注意書きを日本語の実機画面で確認。
- [x] FAQの戻るボタンを全Q&Aの下に移動し、公開画面で反映を確認。
- [ ] 英語表示とスマホ表示を実機確認。

### 2026-10-07 Ranking / Territory 共通公開表示名の修正
- [x] 両ページの名前欄を「公開表示名（Ranking / Territory共通）」へ統一。
- [x] アカウント名と違う名前でOK、アカウント名は変更されないと日英で明記。
- [x] Territoryに共通公開表示名と自己申告所属国・地域の編集欄を追加。
- [x] Territoryのみ参加可能と明記し、Rankingでの事前設定を不要に変更。
- [x] 同じranking_settings.ranking_display_nameへ保存し、各ページ読込時に共通値を取得。既存の他部門参加設定を保存データに含めず維持。
- [x] 両ページの構文、Territoryの初回登録・既存設定維持・空名拒否を模擬テストで確認。
- [ ] 公開後、Territoryで名前変更→保存→Rankingを開いて反映確認。逆方向も確認。アカウント名が変わらないことを確認。

昨日の共通フッターと地図の注意書き、海外対応を維持。本番DBへの実保存はユーザー実機で確認待ち。
