# PR #208 — 本番DB適用前 読取専用プリフライト（2026-11-17）
**結果：条件付き確認／DB適用・マージ・UI配信は未承認・未実施**。

## 対象・観察
- Supabase project `runners-rings` (ref `fhwvntpzwyenendhcgbw`): ACTIVE_HEALTHY、PostgreSQL 17。**SELECTだけ**を実行。実ラン記録、参加者、距離などの個人・集計結果は取得していない。
- `public.ranking_nations_monthly(p_year integer,p_month integer)` は実在。戻り列 `place bigint,country text,participants bigint,km numeric,month_km numeric`。
- owner `postgres`、STABLE、SECURITY DEFINER、`search_path=''`。
- `anon` と `authenticated` にEXECUTEあり、`PUBLIC` に権限なし。
- 現行関数の定義をSELECT内の文字列照合で確認：旧月間合計式と `round(sum(month_km),1) AS month_km` は実在し、年間順位・年間表示列の式も存在。関数定義ハッシュMD5は `a7c4bf3f7944f2d1c3bb872d79f406b4`（照合用、定義全文の保存ではない）。
- `ranking_distance_monthly`、`ranking_explore_monthly` も存在・公開ロール実行可。新設候補 `ranking_nations_month_places` は本番に未作成。
- `pg_depend` の normal dependency count は1。ただしこれだけで依存関係を安全確認済みとは判定しない。
- GitHubの公開コード検索では `ranking_nations_monthly` の参照は `ranking.html`・`supabase/ranking-monthly.sql`・`scripts/test-ranking-monthly.cjs`。旧SQLの自動再適用が**ないことの証明ではない**。

## 残ゲート
1. 本番関数と候補の完全な意味差分、所有者/ACL/依存関係（参照元と参照先）をむせが追加検証。関数定義の現物を非公開保管するバックアップは未作成。
2. DB適用・GitHub mainマージ・UI配信それぞれにAtsuoの**別途明示承認**が必要。現状未承認。
3. 旧SQL再適用防止をワークフロー/管理手順で確立。検索結果だけで断定しない。
4. 適用後の匿名・認証済実HTTPで **全行月間NULL**、年間列は適用前と一致。実データを証拠文書に記載しない。DB先行確認完了まではUIを配信しない。
5. 375px/iPhone、日英、年/月切替、共有画像、旧Cache/SW、レスポンス逆転の本番監査が残る。
6. 年間NATIONSの公開 `km`・`participants` による推測リスクは残る。既存年間公開方針は別判断。

## 次の監査
本ファイルが本番読取の結果と整合し、過度な「本番準備完了」判定をしていないか確認する。PR #208 の候補SQL・HTML・テストは変更しない。

**HOLD**: マージなし / SQL適用なし / UI配信なし。PR #206（月間順位）の開発・公開承認も別。
