# PR #126：iPhone Safari「戻る→進む」／bfcache識別ページ（合成表示のみ）

## 目的
PR #125で記録した本人のiPhone実機確認は「別アプリ」「別タブ」「別ページ→戻る」で5区間が消えたというもの。Safariの「進む」と、実際にbfcacheで復帰したかどうかは未確認。本PRはこの区別をSafari画面上に表示する専用の合成表示ハーネスを新規追加する。

## 2つの試験ページ（mainへのマージ前は未公開）
- 開始：previews/rings-now-safari-forward-bfcache-start-20261114.html
- 試験：previews/rings-now-safari-forward-bfcache-probe-20261114.html

実FITの検証ページではない。FIT読み込み・ファイルピッカー・実ラン・位置情報・心拍・認証・データ永続保存・API送信は一切設けない。架空の5つの区間ペースを単にDOMに表示するだけ。既存#120のFIT SHA検証や本番Rings Now設定には触れない。ページは公開GitHub Pages上の一般公開コードになるため、noindexはアクセス制御ではない。

## iPhone実機操作（マージ後、本人の別途操作）
1. Safariで開始ページを最初に開く。
2. 「試験ページへ進む」をタップし、次の画面で「架空の5区間を表示」を押す。
3. Safariの戻るで開始ページへ戻り、続いて進むで試験ページへ再度移動する。
4. 何も押さずに5区間が残っていないことを確認。
5. 画面の「復帰：bfcache (persisted=true)」ならSafariが以前のページを復元した観測。「復帰：新規読み込み (persisted=false)」ならその操作ではbfcache復帰を実証していない。persisted=falseでも5区間が消えているなら表示失効の確認に留める。

pagehideとvisibilitychangeで結果を消去し、その文書ではボタンも無効にする。pageshow(persisted=true)でも消去。再ロードされれば新しいDOMとして初期化され、ボタンが有効になる。「ページが新規ロードされた」と「復元された文書で以前の結果が消えている」は異なる。イベントが観測されずbfcacheが起きない環境では、bfcache安全性の確証を得たとは言わない。

## 監査境界・残課題
- 新規5ファイル（2HTML、実動するinline JSをvmで実行するNodeテスト、文書、CI）だけ。index、sw.js、既存公開合成FITページ、DB、SDK、本番フラグは無変更。
- 内容は「ページに埋め込んだ架空の数値表示」であり、実FIT解析の失効検証と同一視しない。
- pageshow.persistedは一つの観測値だが、SafariのHTTPキャッシュ/CDNへの残存、実ネットワークの安全性、古いタブの強制撤去可否を証明しない。
- Nodeテストでは画面で実際に使うinline JSを抽出してDOMとイベントを模擬する。Safariでpageshow.persisted=trueが発生することはCIでは保証できない。
- 方式Aの14証跡は本PRで自動的にtrueにしない。実FIT画面公開、実FIT使用、正式な本番ONはいずれも未承認。追加費用0円・iPhone優先・既存機能不変。

## むせへの独立監査依頼
1. 新規5ファイルだけか。既存index/SW/解析コード／DB／合成FIT画面に変更なし。
2. Safariの「戻る→進む」が履歴として成立する2ページ構成か、新しいタブを開かないか。
3. 実際のinline JSで架空の5区間が表示され、pagehide、visibilitychange、persisted=trueによって消去されるか。
4. persisted=falseをbfcache合格と言い換えず、新規文書のロードと区別しているか。
5. 外部送信、ブラウザ保存、実FIT入力・解析がないか。CSPは適切か。
6. CIと既存回帰が成功し、実FIT使用・本番ONは未承認のままか。

監査のみ。本人の明示承認前はマージ・公開を行わない。