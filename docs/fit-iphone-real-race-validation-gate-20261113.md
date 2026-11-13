# iPhone Safari / 2026ぐんまマラソンFIT 実データ検証ゲート（2026-11-13）
状態：PR #67 Draft・未公開・本人実機未検証。新たなGitHub Pages公開や本番デプロイを許可しない資料。

## 今すぐ確定していること
- 画面：`previews/ima-wo-shirou-fit-local-file-draft-20261113.html`。本番配信はしておらず、単体の`file://`で開いても相対ESMのため正常動作は保証されない。
- 解析：`src/race-fit-local-file-review.mjs`、同梱FIT SDK。端末内で本人が選んだ**単一 .fit（16MiB以下）**を読み、メモリ上で1km候補と品質フラグを返す。ZIP/TCX/GPXや複数セッションはこの検証ページでは対象外。
- UIに本人確認とレース/記録挑戦確認があるが、これは**自己申告チェック**であって技術的なファイル所有証明ではない。privateViewもUI隔離による実装上の主張にすぎず、公開認証済み画面ではない。
- 出力は`candidate_unverified`、`analysisAllowed=false`、`writeAllowed=false`。受信API、年輪、保存機能、SNS共有、ランキングには接続しない。
- Garmin Starterからの書面回答は解除APIの意味論を解決していない。今回の本人持込FIT経路とは別扱い。

## 非公開LANプレビュー：実装候補（未使用・未承認）
- `scripts/serve-private-fit-preview.py`：追加費用0円、Python 3標準ライブラリだけで動く15分限りのHTTP配信。PCのプライベートIPv4を明示して起動。起動ごとに長いランダムなアクセスURLを作成し、最初に開いた端末のIPに限定。Cookie認証後、検証用HTMLと必要な`src`の固定モジュール、`fit-sdk/src/*.js`のみGET配信。`POST/PUT/DELETE`禁止、no-store、noindex、外部へのconnect-srcをCSPで拒否。
- **重要**：LAN内のHTTPは暗号化されない。ページのJSやアクセスCookieが同じネットワーク上で盗聴され得るため、外出先、公衆Wi-Fi、共同Wi-Fi、ポート転送、VPN越えでの利用はしない。信頼できる家庭内Wi-Fiのみ。ラン本人のFIT本体は端末内の`File.arrayBuffer()`で読み、サーバへは送らない設計。実際のトラフィックをiPhone実機で検証した証明ではない。
- **PCとiPhoneが同じ信頼済みWi-Fiに接続されている場合の手順案**：PCでPR #67の開発ブランチをチェックアウトし、PowerShell等でリポジトリのルートへ移動。`ipconfig`でPCのプライベートIPv4を確認。`python scripts/serve-private-fit-preview.py --host 192.168.x.x`（x.xは手元の値）で起動。表示される15分限定URLをiPhone Safariで開く。接続できなければPCファイアウォール・同一サブネット・iPhoneのWi-Fiを確認。**ユーザー承認前に外部向け例外ルールや公開設定を追加しない**。確認を終えたらPCで`Ctrl+C`。
- **プライベートIPv4が分からない場合は想像で入力しない**。PCの構成、Windows Defender Firewallの許可範囲、家庭内LANの外部公開有無を確認する。初回の実機確認は本人の判断に従い、こちらから勝手にサーバ起動しない。
- CI：`tests/test_private_fit_preview_server.py` はlocalhostで正常な認証・拒否・15分失効・ファイルallowlist・HTTP MIME・POST拒否を検証する。実機/実データ/暗号化まで検証するものではない。サーバプロセスは起動せず、GitHub Actions内でテスト用のlocalhostサーバのみ一時起動する。

## 追加のプレ公開レビュー（2026-11-13）
- `scripts/serve-private-fit-preview.py` のHostヘッダーを起動時のIPv4:portに固定し、不明なホスト名を403にする。開通URLのHEADは405として、ブラウザの先読み・ヘルスチェックが最初の端末IPを占有しないようにする。
- `tests/test_private_fit_preview_server.py` で検証HTMLと全静的ES module importを再帰追跡し、認証済みGETで200とJS MIMEを確認。FIT SDKの下位モジュールも含む。プライベートLANサーバの予期しないファイル配信や、外部モジュールの参照を防ぐためのテスト。
- CI run **43371848682 completed/success**。途中のテスト正規表現の誤記は修正済み。**静的import全体の確認はブラウザSafariでのロード確認の代わりではない。**
- iPhone実機試行の許可はまだ出していない。HTTPで配信されるJavaScriptがネットワーク上で改ざんされ得るリスクは残るため、完全なプライベートHTTPSと同等ではなく、むせ独立監査＋本人判断までは**実FITを使った試行を開始しない**。

## まず架空FITだけで試す準備（2026-11-13）
- `scripts/make-synthetic-race-fit.mjs`：本人のランニング履歴とは**無関係**な合成ランニングFITを、リポジトリにあるSDKで生成。架空の5km/27:00、1km候補は5:15・5:18・5:20・5:24・5:43。位置・心拍・ケイデンス・パワー・氏名などの個人情報は含まない。外部通信なし。
- 使用するPCに開発ブランチを安全に取得した後、出力先を本人のPCローカルフォルダに明示して `node scripts/make-synthetic-race-fit.mjs C:\\Users\\...\\synthetic-5km.fit` のように実行可能。既存ファイルの上書きを拒否する。**現時点では本人PCで実行していない**。
- `tests/race-fit-private-rehearsal-fixture.test.mjs` にて同梱SDKによるFIT CRC・デコード・1kmラップの期待値、位置/心拍等の不存在、自己申告の確認ゲート、保存禁止を検証。**GitHub Actions run 43372883378 completed/success**。
- iPhoneのSafariで開く導線は未監査。まず架空ファイルで表示/読込のみ試す。非暗号化HTTP上で**本人の実FITは読み込まない**。架空のFITでの表示が成立しても、個人FITを試す許可や解析精度の品質保証にはならない。
- サンプルFITの出力をGithubへコミットする必要はない。PCからiPhoneへファイル転送する手順も、本人の環境に合わせて別途確認する。

## iPhoneに直接保存できる架空FIT（2026-11-13）
- `scripts/make-synthetic-race-fit-portable.py` はPython標準ライブラリだけで、294バイトの匿名FIT（2020-01-01の架空日付、5km・27分）を生成する。既存ファイルへの上書きは禁止。
- `tests/race-fit-portable-python-fixture.test.mjs` は生成された**実バイナリ**を同梱FIT SDKの`checkIntegrity`と`read`で検証し、`reviewSingleUserFitBuffer`の1km候補が5:15・5:18・5:20・5:24・5:43になること、GPS/心拍フィールドなし、DB書込不可を確認した。**CI #43373777905 completed/success**。
- 個人情報がないFITをChatGPTの会話添付として作成済み。iPhoneでSafari等から`.fit`をダウンロードし、端末の「ファイル」に保存すれば、本人FITを使わずファイル選択の動作を試せる。
- **重要**：この添付ファイルがあることは、非公開LANプレビューや実iPhone側画面をデプロイ済みという意味ではない。実機画面の利用には別途安全な配信手段と独立監査が必要。実レースFITをHTTPプレビューで使うことは引き続きNo-Go。

## PC Chromeの実画面・架空FITの通しテスト（2026-11-13）
- `tests/race-fit-pc-chromium-smoke.test.mjs`：GitHub ActionsのChromeを**ヘッドレスブラウザとして実際に起動**し、Pythonのプレビューサーバーを`127.0.0.1`にのみバインドして、期限付きURLからHTMLを表示。架空の`.fit`バイナリをブラウザのfile inputに設定、確認項目2件をチェックして解析ボタンを押す。実ブラウザ上でFIT SDKデコードを通した距離5.00km、総時計27:00、1km候補5:15/5:18/5:20/5:24/5:43、停止イベント不在の注意を検証。保存/共有は無効。
- 過去のモックDOMテストからの前進点：実際のHTML/相対ESM/CSP/HTTP認証/Chromeのファイル入力/FIT SDK/描画を一続きで確認できた。リポジトリで予め生成した匿名FITのみ使用。
- 初回CI `43375684945` はブラウザの結果が全部一致したが、Chrome一時プロファイル削除時の`ENOTEMPTY`によって失敗扱い。終了処理を改修。再実行 **`43375871967` completed/success**、ブラウザ通し試験・既存FIT・非公開HTTPテストが全て成功。
- この成功は**GitHub ActionsのPC版Chrome**での証拠。本人のWindowsブラウザ、iPhone Safari、本人レースFITでの結果を証明していない。非公開LAN HTTPによる本人データの試験は禁止したまま。本番・年輪・Garmin・Strava・DBへの変更なし。

## Windows PCでの一回限りの簡単確認（2026-11-13）
- `scripts/open-local-fit-preview-windows.cmd`：開発ブランチをPCに取得した場合に限り、Windowsのファイル一覧から起動可能なバッチ。Python 3があればPCの`127.0.0.1`だけで15分限定サーバを起動し、既定ブラウザでローカル画面を開く。一般公開・LAN開放・ファイアウォール変更はしない。終了はコマンド画面で`Ctrl+C`。
- FITとしては、以前渡した**架空の5km/27:00**の`.fit`だけを選択する。本人レースFITを入れる検証ではない。予想される1kmラップは`5:15 / 5:18 / 5:20 / 5:24 / 5:43`。
- `--open-browser`は明示された場合だけ有効で、接続先がPC内部の`127.0.0.1`でなければ拒否。ユーザーPCでの実起動は未実施。Python 3未インストールの場合はエラー案内に留め、勝手にソフトを追加しない。
- GitHub ActionsではChrome実画面の自動E2E試験を継続。Windows本物の環境でのブラウザ表示や`.cmd`ファイルを実行しての検証はまだ未完了。PowerShell実行ポリシー変更、PCのポート外部開放は禁止。
- この手順の主目的は、**PCブラウザで「架空FITを読み込む→5本のラップを見る」こと**。iPhoneとの通信や実レースの取り込みは次の別工程とする。

## Windowsローカル確認用の最小ZIP作成（2026-11-13）
- `scripts/build-private-fit-pc-bundle.py`：検証HTMLにある相対importをFIT SDK下位まで再帰確認し、`serve-private-fit-preview.py`が許可するファイルだけをZIPに同梱する。Windows用`.cmd`、Pythonプレビューサーバ、必要なJS、匿名5km FIT、READMEのみ。元のGitHubリポジトリ全体、Supabase、設定ファイル、本人FIT、認証情報は含めない。
- `tests/test_private_fit_pc_bundle.py`：ZIPの内容・匿名FIT・書込ファイル・不要なファイルの排除・再現性を確認。既存Chromeを使った実際の架空FITファイル選択・5本のラップ表示試験も成功。
- GitHub Actions **run #43378085372 completed/success**：`rr-fit-pc-preview-synthetic`を有効期間7日のActions artifactとして添付（実行結果のArtifacts欄から取得する）。CI初回はテスト側のREADME文字列期待値が不一致で失敗したが修正済。
- PCで実際に起動したわけではなく、ZIPの中身の自動検査とCI上のChrome試験のみ。Python 3がPCに無ければこの方式は起動できない。無断でソフトをインストールしない。
- 使用するFITは同梱の`synthetic-5km-27min.fit`だけ。実レースFITの使用・本番公開・iPhoneへのLAN接続は未承認のまま。

## 実機前ゲート（未確認）
1. 隔離した検証ページを**本人だけに安全に渡す方式**を設計・むせ監査する。一般公開Pagesへ配置するのは避ける。ローカルサーバ検証もiPhone側のHTTPS/CORS/MIME条件を別途確認。
2. iPhone Safariで`FITファイル選択`、自己申告の二つのチェック、端末内解析、警告・表、縦横表示、キーボード/VoiceOver、16MiB超過時の拒否を確認する。**実機確認者は本人**。
3. 同梱FIT SDKの相対モジュール全階層が正しいMIMEで配信されること、Content Security Policy・no-store・認証・noindexだけに依存しない非公開制御を監査する。
4. 本人の**2026/11/3ぐんまマラソン**記録から本人が選んだFITで一度だけ確認する。今のコードは最初のrecord時計とsession開始が完全一致、record距離が0m開始、単一running sessionを要求するため、**実FITが条件に合わなければ正当にブロックし、勝手に補完しない**。
5. 結果は本人が画面上で見た1km候補と公式の記録/時計との比較だけに留める。元FITはGitHub issue/PRコメント/公開ログへアップロードしない。ズレ・停止・心拍/位置情報を含む元データを外部転送しない。
6. 精度の判定：1km候補の分割点は累積距離を線形補間した**未認証の候補**。連続サンプルの時計が疎な場合、停止イベントがある場合、GPS由来の距離と公式コース距離が違う場合は、公式ラップへの一致を保証しない。
7. 望む画面が動作してもPR #67の混在したGarmin解除/分析実装全体をマージするのではなく、監査に合格した**本人持込FITだけ**を独立PRで切り出す。実際の本番追加は本人明示承認が必要。

## 合否判定
- 現時点：**隔離コードと合成FITのCI合格まで。実FIT精度/iPhone Safari/非公開配信経路は未検証**。
- 本人が既にFITを所有していることと、こちらにアップロードする義務は別。実レースFITの提出は依頼せず、本人が安全な検証方法を選べる状態にしてから進める。
- 追加費用0円。本番・Supabase・OAuth・Push・年輪・保存済みrunsには変更を加えない。
