# Rings Now — RPC応答の純粋な形状変換とマイクロ秒（隔離レビュー）

## 現状
- PR #152のSQL候補（未適用）は `{status:'candidate_snapshot', rows:[six fields]}` または `{status:'blocked',reason}` を返す。
- 既存 `createRingsNowAuthSnapshotBoundary` は `ownerId/ownerScoped/unmodifiedSnapshot/rows` を期待する。
- **変換するだけでは実Auth・実JWT・実RLS・実RPCの実行が証明されない。** `src/rings-now-rpc-envelope-review.mjs` は候補RPCの**模擬応答を厳格に検査して最低限の6列だけにする純粋関数**。この結果には `ownerScoped` や `unmodifiedSnapshot` を付与しない。既存の境界へ直接渡しても拒否される。
- 実結線には、承認された将来の専用トランスポートが現在の実JWTに紐付けてRPCを実行したこと、RLS、鮮度、Auth eventでの失効を証明し、その**信頼された処理の結果**だけが境界に入る必要がある。モックの自己申告で代替してはならない。

## 小数秒と8日境界
`public.runs.started_at` は実DBでtimestamptz型と確認済み。PostgRESTでは最大6桁の小数を含むISO文字列を返し得る。既存のカレンダー入力と走行開始時刻検査の両方を1〜6桁に拡張し、元の文字列は変更しない。

JavaScript `Date.parse` はミリ秒精度であり、最大6桁の小数秒を正確なマイクロ秒として比較できない。既存の8日=691,200秒のゲートはミリ秒精度を前提とする。ミリ秒以下の境界は**依然未検証**であり、本番解析許可を出さない。将来の結線では時刻の精度・端数処理・境界を明示的に検証すること。

## テスト対象
純粋モックで、正常な6桁の開始時刻、ステータス別遮断、余分な列、外国人行、NULL、重複、順序、1,000件超、直接境界への接続拒否を検証。リポジトリの公開HTML/SW、DB、Auth、実HTTP、FITを使わない。対象は文字列とモックの隔離レビューであり、実PostgREST応答や実JWTの証拠ではない。

## 承認境界
SQL適用禁止、実DB追加アクセス禁止、実Auth・実HTTP・実FIT・実カレンダー結線・本番ON禁止。PR #109はHOLD、index入口OFF・開始時刻nullを維持。むせ独立監査と所有者明示承認まではマージ不可。
