# Rings Now：iPhone合成FITのみ実機確認する試験ページ（2026-11-14）

## 目的
本人が決定したRings Now（NOW＝今 × KNOW＝知る）と**iPhone最優先**に従い、PCを必須にせず標準のiOS Safariファイル選択・Blobダウンロード・WebCrypto SHA-256・既存FIT SDKの実行可否を合成FITだけで試せる最小画面を隔離作成した。

## 変更範囲・隔離
- 新しい静的プレビュー：`previews/rings-now-iphone-synthetic-only-20261114.html`。
- 既存の監査済み`src/race-fit-local-file-review.mjs`のみをimportし、1回の合成FITだけ端末内デコードする。
- 内蔵データは既存のPythonジェネレーターから出した**架空の5km/27分、294bytesのFIT**。GPS・心拍・個人情報は含まない。SHA256完全一致をデコードの**前**に要求。ZIP／他のFIT／本人の実FITをデコードしない。名前とサイズの一致だけでは許可しない。
- 合成FITダウンロードはブラウザ内のBlobから。選択はFile input、デコード前のSHA-256はWebCrypto、結果は未認証。外部通信・フォーム送信・DB書込・永続保存は不可。CSP `connect-src 'none'`。
- 旧称「今を知ろう」の内部モジュール名は互換性のため維持し、UIはRings Nowの正式名。時計経過時間に停止が含まれること、注意書きを維持。
- **index.html、sw.js、既存公開サイト、DB、カレンダー、実FIT読み取り画面、実装済みFIT SDKは変更しない**。

## 何が未検証か
- このPRはiOS Safariで実際に動いた証明ではない。GitHub上の未マージDraftブランチのファイルはiPhoneで安全に開けるHTTPS試験サイトを提供するものではない。
- ユーザーへのURL提示や実機の試験は**レビュー／監査で安全な配信方法が承認されるまで保留**。PRをマージしてGitHub Pagesへ露出することも本人の明示承認なしに行わない。
- 静的ページにnoindexは設定したが**アクセス制限・秘密保持ではない**。合成データのみだからといって本番公開承認済みとはしない。
- iOSのFilesへのダウンロード保存可否、ファイル名保持、選択、WebCrypto対応、Safariのモジュール読み込み、1km候補値、速度、メモリと中断動作は実機確認が必要。
- 実Garmin FITについては非対応・未承認。11/3レースは本番の走行開始から8日間の期限切れ。過去データの本番診断はしない。

## むせ監査
1. 本PRの差分が3ファイル（隔離HTML／静的テスト／CI）のみか。公開サイトは無変更か。
2. Pythonの合成FIT 294bytesとバイト一致・SHA-256一致であること。実FITがデコーダへ到達しないこと（名前・サイズ・digestの3段確認）。
3. 予期しない通信・保存・データ露出がないこと。ブラウザのファイル読取後、別ファイルへの切替や完了の競合を確認。
4. iPhone動作、配信、実FIT読み込みを実施済みと主張していないか。
5. 既存の8日ルール、本番OFF、PR #109 HOLD、正式名称の由来NOW×KNOWを守るか。
6. CI成功後、本人の明示承認まではマージ・公開しない。

テスト：`python3 -m unittest discover -s tests -p test_rings_now_iphone_synthetic_page.py -v`。
