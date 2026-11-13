# Garmin OAuth 解除の世代フェンス — 隔離修正候補（2026-11-13）

**本番非適用／Draft PR #67／独立監査待ち。**

## 実装案
現行 `supabase/functions/garmin-oauth/index.ts` は、`/disconnect` の最初の書込みが `PATCH garmin_api_connections?user_id=eq.<uid>` であり、同じ本人の再連携が先行すると新しい接続世代の `import_enabled` を false にできてしまう。

`scripts/garmin-disconnect-fence-candidate.mjs` は**本番ソースを変更せず、厳密に一致する一箇所だけをメモリ上で置換**する隔離試験用の候補。①現時点の `connection_version` を読み、② `user_id + connection_version` の両方で停止PATCH、③0行なら再連携の競合に負けたと判断して、以後の旧世代の遠隔解除を始めず終了する。元コードの最終DELETEも世代指定済み。

`tests/garmin-disconnect-fence-candidate.test.mjs` は、現行ソースと隔離候補をともにメモリ上で実行する。現行のユーザーIDのみのPATCHが新世代を停止できてしまう負例、候補で再連携がPATCHの前に挟まった場合の保護、通常解除、行消失を確認。

## CI
GitHub Actions run `43341838253` success。新設候補に対するテスト、受信ソースのオフライン再試行テスト、形状検査の隔離テストが成功。

既存 `scripts/test-garmin-oauth.mjs` を今回CIに加えて実行したところ、元々の接続開始テストのmockが現在の `garmin_oauth_sessions` POSTを想定せず失敗（最初の `/start` が本番未変更の状態で503）。**古いOAuthスイートの合格を主張しない**。CIから一時的に除いて候補専用テストで評価。既存テストを現行仕様に追随させる修正・再合格は残件。

## 残る安全ゲート
- **停止PATCH完了後の再連携**：元の古い認証トークンによるGarmin側 `registration DELETE` が、再連携後の権限に与える影響は未証明。最後のDB世代付きDELETEだけでは外部サービスの失効を防げない。callbackの接続世代保存、OAuth解除、workerとの排他やprovider意味論を追加監査すること。
- `GET version → PATCH version` は同時実行に対する条件付きUPDATEだが、解除の意思とどの接続を対象にするかのUX仕様を確認すべき。0行時は画面に `?garmin=connected` を返す試験用挙動を採用しており、本番のユーザー案内として適切か要判断。
- スナップショット取得を含む追加のREST往復、失敗時の再試行、worker lease、暗号化トークン更新、古い行への重複解除、Secretの非露出を独立監査。
- 本番DB、Auth、OAuth関数、受信、年輪は変更ゼロ。追加費用なし、#67 Draft、#68 HOLD。**レビューと本人の明示承認前にデプロイ・マージしない。**
