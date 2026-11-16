# Rings Now P2 — 公式版の依存候補調査（NOT RUN）

調査日 2026-11-16。PR #174の監査済みHEADは変更しない。本書は依存候補の調査のみ。イメージpull、Actions dispatch、DB/Auth/PostgREST起動は実施していない。

## 公式の候補
- PostgreSQL: Docker Official Image `postgres:17` 系。正確なpatch版、linux/amd64 digest、Supabase固有拡張の要否は **TBD**。https://hub.docker.com/_/postgres
- GoTrue: `supabase/gotrue:v2.197.0`。Supabase公式Docker versions.md の2026-10-16更新で採用。digest **TBD**。https://github.com/supabase/supabase/blob/master/docker/versions.md
- PostgREST: `postgrest/postgrest:v14.18`。同じ2026-10-16更新で採用。digest **TBD**。https://github.com/supabase/supabase/blob/master/docker/versions.md
- PostgREST公式Docker導入: https://github.com/postgrest/postgrest/blob/main/docs/explanations/install.rst
- Supabase Auth公式説明: https://supabase.github.io/auth/

## 残る実行禁止ゲート
1. 各イメージの**正確なlinux/amd64 sha256 digest**を公式レジストリで検証し固定。タグだけでは不足。
2. GoTrueの実サインアップ/サインイン/JWT発行、PostgRESTによるJWT署名・role・aud・exp検証の構成と互換性を実証する。公式構成に同時掲載されていることは互換性実証ではない。
3. PostgreSQL fixtureでauth schema/uid()/GRANT/RLSと候補SQLを本番なしで再現。Supabase独自拡張との差分を明示。
4. Actions請求画面で実費/利用条件を確認。**0円未確認**。
5. PR #174のhard stop解除は別PR、独立監査、Atsuoの明示承認。dispatchはさらに別承認。

**ステータス**: 依存タグ候補のみ確認。manifestのnullを埋める根拠なし。P2 A1–A6 NOT RUN、本番OFF・開始時刻null・PR #109 HOLDを維持。
