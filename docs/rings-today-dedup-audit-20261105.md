# Rings Today 二重表示の独立監査依頼（2026-11-05）

## 発見
iPhone実機でログイン後のメイン機能カードにRings Todayが二つ表示。ユーザーからログイン前も重複していると追報された。

## 原因
`index.html` にはログイン後の `#dashboard .rrFeatureTiles a[href="./today.html"]` およびログイン前の `#authArea .authPublicLinks a[href="./today.html"]` が既に存在する。旧共有スクリプト `runner_rings_archive.js` の `addRingsTodayLinks()` が、旧スクリプト自身の追加IDが見つからないことだけをチェックして、同じTodayへの別のカードを追加していた。起動時だけでなく後続リトライとMutationObserverでも重複追加のきっかけとなる。

## 変更
1. `runner_rings_archive.js` のログイン後・ログイン前双方の条件に、現行indexのTodayカードが既に存在する場合は追加しないガードを追加。旧Todayカードが存在していれば従来通り増殖を防ぐ。今後正式カードが無い画面では旧追加導線を保つ。
2. MutationObserverが毎回古いカードを補おうとする条件も修正。正式なログイン後カードが存在するときは旧カード不在を理由にbootしない。
3. `index.html` で読み込むarchiveのバージョンを `20261105-today-dedupe-01` に更新し、iPhone Safariの古いキャッシュを回避。

**変更は2ファイルのみ。today.html・ログイン・ラン保存・年輪・DB・同期コードへの変更なし。** PRはDraft、未マージ未公開。

## 監査項目
- ログイン後は正式なTodayカードが1枚だけになるか
- ログイン前も正式なTodayカードが1枚だけになるか
- 英語切替後と画面復帰（visibilitychange / pageshow）時に二重化しないか
- 旧スクリプトのMutationObserverによる追加・リトライを正しく抑制するか
- 正式カードが存在しない画面の旧導線を不必要に壊さないか
- 既存サイト機能、iPhone幅、余白・グリッド・誘導先への影響
- indexのキャッシュバスターが適切か
- mainにマージ可か。マージ後のGitHub Pages配信とPC/iPhoneのログイン前・後の実機チェックは別途行う

**独立監査のみを依頼。コード変更、マージ、DB変更はしない。**