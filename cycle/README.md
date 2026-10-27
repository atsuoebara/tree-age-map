# Cyclist's Rings — 初期版

2026-10-27。既存 `atsuoebara/tree-age-map` に `cycle/` のみを追加。
既存 index.html、CNAME、Supabase、Edge Functions、Journal生成処理は変更しない。

## 実装済み

- 自転車GPX（trkseg / rte）の取り込み、地図表示、距離と経過時間
- ロードバイク／ママチャリ／その他、月別絞り込み、個別表示・削除
- 専用localStorage `cyclists-rings:rides:v1`、重複抑止
- JSONバックアップの書き出し・復元（別ドメインへ移行可能）
- 共通Journal https://runnersrings.com/journal/ へのリンク
- スマートフォン対応。新しい画像・広告・解析は追加していない

同一GPXは自転車の分類を変えても二重登録しない。別日なら別記録。
GPXに種目がない場合もあるため、自転車の記録であることは利用者が確認する。
時間は移動時間ではなく、最初と最後のGPS点の経過時間。日付はGPXの先頭時刻表記に従う。
複数セグメント間は線で結ばず距離にも加えない。GPS外れ値の自動補正は未対応。

## 未実装

Strava自転車同期、クラウド同期、ログイン、ライブGPS記録、FIT、レインボー、タイムラプス。
この版はブラウザー内保存のため端末間で自動同期しない。

## 公開先

既存Pagesへ追加する場合は https://runnersrings.com/cycle/ 。
既存リポジトリのCNAMEを cycle.runnersrings.com に変更してはいけない。

希望サブドメインは別の公開リポジトリ `cyclists-rings` を作り、このcycleフォルダーの
index.html / style.css / core.js / app.js / privacy.htmlをルートへコピーする。
1. 新リポジトリの Settings → Pages → Deploy from a branch → main / (root)。
2. PagesのCustom domainに `cycle.runnersrings.com` を保存。
3. DNS管理画面で `CNAME`、名前 `cycle`、値 `atsuoebara.github.io` を追加。
   本体のAレコード・wwwレコードは変更しない。
4. DNS確認後にEnforce HTTPSを有効化。反映は最大24時間程度かかる場合がある。
5. 新URLでGPX取り込み・再読み込み・バックアップ復元を確認。
   既存URLの保存データはバックアップで新ドメインへ移す。

今回利用できるGitHub接続にはリポジトリ作成・Pages設定の書き込みAPIがない。
DNSサービスへの接続もないため、この設定はユーザー操作が必要。

## 既存連携の確認

Supabase: `runners-rings` / `fhwvntpzwyenendhcgbw`、ACTIVE_HEALTHY。
public.runsほか既存テーブルはRLS有効。自転車テーブルは確認できず。
strava-sync v46の実コードは Run/TrailRun/VirtualRunのみ対象、保存先runs、
CORS許可元は https://runnersrings.com のみ。既存接続情報は流用していない。
Stravaアプリ管理画面の利用者上限・承認状況・コールバック設定は未確認。
将来は独立したrides保存先と所有者単位RLS、自転車用OAuth状態・コールバック、
Ride/EBikeRide等の種目選別、本人限定表示、削除対応、API上限の確認が必要。
既存runsへ自転車を混入させる改修は行わない。

Strava API Agreement（2026-06-01発効）は本人のデータのみ本人へ表示する制約や
競合・機能複製の制約がある。自転車版の用途について承認範囲を確認してから連携する。
契約適合や利用承認済みとは判断していない。

## 費用

今回、新規契約・ドメイン購入・有料プロジェクト・API課金は追加しない。
GitHub Freeの公開リポジトリPagesを使用可能。地図は既存同様Leaflet 1.9.4と
OpenStreetMapの標準タイル（利用ポリシーの範囲内、SLAなし）。
Supabaseの契約プラン・請求額は未確認だが、本実装は接続せず負荷を増やさない。
既存ドメインの更新費や既存契約費がゼロになるという意味ではない。

## 確認

`node --check cycle/core.js` / `node --check cycle/app.js` / `node cycle/core.test.cjs`。
既存 `node check-index.js` は追加前から「選択ランの青線設定」の2項目が失敗。
この変更に既存コードの修正は含めない。

参照:
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- https://www.strava.com/legal/api
- https://developers.strava.com/guidelines/
- https://supabase.com/pricing
- https://operations.osmfoundation.org/policies/tiles/
