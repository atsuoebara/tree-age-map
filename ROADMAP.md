# Runner's Rings 更新ロードマップ（2026-10-01）

> GitHub上の本ファイルを進捗の唯一の正本とする。
> 完了済み事項を理由なく未完了へ戻さない。
> 開発再開時は本ファイルと現行ファイルを確認してから着手する。

## 確定した開発優先順位

1. 年輪タイムラプス共有
2. Rings Territory（仮称）／市町村別の年間陣取り
3. 細かな修正・安定化
4. キャラクターデザインの保管・再利用

AdSense / SEO / SNS運用は別枠で並行する。

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

### 継続確認
- [ ] 海外実ユーザーでの利用状況を継続確認
- [ ] 同率・年切替・重複等の細かな集計ルールを必要に応じて調整
- [ ] 公開範囲 / RLS / 集計負荷を継続監視

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

## D. 年輪タイムラプス共有【次の最優先】

### 目的
Runner's Ringsの「走った人生」「年輪の積み重なり」を、地図が育っていく動画として共有できるようにする。

### 確定仕様
- [ ] タイムラプス開始時の現在の地図中心位置を固定
- [ ] タイムラプス開始時の現在のズーム倍率を固定
- [ ] 自動で別地点や全体表示へ移動しない
- [ ] `コース` 表示に対応
- [ ] `面` 表示に対応
- [ ] 開始年月 ～ 終了年月を選択
- [ ] 日付単位の指定は行わない
- [ ] 月ごと / 年ごとの再生に対応
- [ ] 最初は走行データ0の地図から開始
- [ ] そこから走った道・面が時系列で積み上がる
- [ ] 共有用はInstagram Reels / Storiesを意識した9:16
- [ ] 共有動画の隅にRunner's Ringsロゴを常時表示
- [ ] 共有動画の地図外周にピンク＋イエローのブランド枠
- [ ] 通常地図にはブランド枠を常時表示せず、共有時の特別感を優先
- [ ] 最後に `Map the life you run.` を表示する方向

### 実装方針
- [ ] 既存のALL / 年 / 月フィルタと地図描画処理を最大限流用
- [ ] 通常の地図操作や既存表示を壊さず、タイムラプス専用UIとして追加
- [ ] まず実機で「再生」を完成させ、その後「動画共有」を実装
- [ ] iPhone Safariを最優先で確認

### 最初の実作業
1. 現行 `index.html` の地図描画・年/月フィルタ・面/コース切替処理を特定
2. タイムラプス用のUIと状態管理を最小追加
3. 現在の中心位置・ズームを保持したまま、0 → 月/年ごとの累積描画を再生
4. 実機確認後、9:16共有動画生成へ進む

## E. Rings Territory（仮称）【タイムラプス後】

### 基本方針
- [ ] 独立ページで実装
- [ ] 日本は市町村単位
- [ ] 年間の競争
- [ ] Rings Rankingと同じ思想
- [ ] 参加は任意・初期OFF
- [ ] 参加ONユーザーだけを集計・表示
- [ ] 他ユーザーの年間記録を地図上で確認
- [ ] 表示名・地域名・プロフィール導線など公開範囲を個別設定できる設計を検討
- [ ] メイン地図「自分の年輪」と混在させない

### 未決定
- [ ] 陣取り判定を市町村内年間距離だけにするか最終確定
- [ ] 同率処理
- [ ] 地図上の所有 / 上位表示方法
- [ ] 過去年の履歴表示方法

## F. 地図・安定化

### 完了
- [x] 走路タップ時の「この場所を走った記録」を最新20件＋20件ずつ追加表示
- [x] ポップアップ内スクロールで全履歴へアクセス可能
- [x] 2026-10-01 実機確認済み
- [x] GitHub Actions Success確認済み

### 継続監視
- [ ] Leafletの面 / コース再描画タイミング問題
- [ ] 海外地域別一覧など、実ユーザー報告があった不具合
- [ ] Garmin Connect IQの実機送信・審査

## G. Strava / 外部連携

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

## H. SEO / AdSense / クローラー

- [x] `sitemap.xml` 稼働
- [x] `ranking.html` をsitemapへ掲載
- [x] Journal記事のGoogleインデックス確認
- [x] `robots.txt` を追加
- [x] `User-agent: * / Allow: /`
- [x] sitemap URLをrobots.txtへ明記
- [x] Search Console「検索の生成AI」は「含める」
- [ ] Gemini側の `URL_FETCH_STATUS_GOOGLE_EXTENDED_OPT_OUT` が反映後に解消するか確認
- [ ] AdSense再審査結果を確認

## 次の実作業

**年輪タイムラプス共有を開始する。**

最初は動画書き出しまで一気に進めず、
「現在見ている位置・縮尺を変えず、0から月/年ごとに年輪が増える再生」
を実機で完成させる。

その後、
9:16共有フレーム、Runner's Ringsロゴ、ピンク＋イエロー枠、
動画生成・SNS共有へ進む。
