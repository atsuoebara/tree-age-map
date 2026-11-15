# Rings Now P1 — 実行前の承認パッケージ v0.1（文書のみ・未承認）

基点：main `3ece9e70`、PR #158・むせ追補59、むせ追補60の助言。作成日：2026-11-15。
**状態: P0 / REVIEW ONLY / NOT RUN.** この文書の作成・監査・マージは、P1実行承認とみなさない。

## 1. 調査対象・主体・証拠
- 対象：Runner's Rings、既存Supabase Pro本番の `runners-rings`、参照ID `fhwvntpzwyenendhcgbw`。これはむせ追補60の**既存調査報告に基づく事前情報**であり、**本操作では現行ダッシュボードでの目視一致を未確認**。
- 実行：Atsuo本人、対象のSupabase Dashboard SQL Editor、実行ロール `postgres` の提案。本人のログイン・操作が前提。実際のEditor表示のロールが一致しなければ中断。チャッピー／むせにログイン情報を共有しない。
- 照会対象：PR #158にあるQ1〜Q4の**同一SELECT原文9本**。この文書では各1本を独立 `BEGIN; SET TRANSACTION READ ONLY; SELECT ...; ROLLBACK;` で包んだ形だけを提案。**包んだ形の全文を別途監査・本人承認するまで実行禁止**。
- 実行回数：各照会1回だけ、結果が見切れる場合のみ同一セッションで同一照会文を最大1回再実行可という追補60の案。Q1で関数が未作成ならQ2は不要／0行となる想定だが、実際の結果に合わせて停止・報告。SQL Editorのトランザクション表示/動作仕様が不明なら開始しない。
- Q5：Data API公開スキーマ・設定と、既存プラン/Compute/Spend Cap/利用量/請求状況の**画面閲覧のみ**。変更、HTTP通信による実APIテスト、スクリーンショットの機密共有は禁止。
- 候補 `docs/rings-now-single-statement-snapshot-CANDIDATE.sql` の実行、DDL/DML/GRANT/REVOKE、RPC、実JWT、PostgREST実呼び出し、`public.runs` 行SELECT、`EXPLAIN ANALYZE`、負荷試験、新規プロジェクト/ロール作成、FIT取り込み、公開入口ONは禁止。

## 2. 料金と実行前ゲート
むせ追補60の2026-11-14時点の巡回値：Pro/Micro、Spend Cap ON、想定請求$27.50/月、超過0、有料アドオンなし、新規プロジェクトなし。**最新画面での再照合は未実施**。増分0円は見込みであって、固定費$27.50/月が無くなるという意味ではない。
- 実行前に対象ref・組織・環境・ロール、Spend Capと課金・利用量の現状、既存プランとアドオンを目視確認。いずれか不一致なら中止。
- リソース追加、費用の発生可能性、想定外の結果、権限不足、機密情報表示、時間がかかる照会、Editor上のトランザクション非対応やSQL書換要求では中止。
- Supabaseの既存Pro利用枠・課金表示以外は推測しない。SQL SELECTにも実行負荷はあり得るため、零負荷を保証しない。
- 出力はrole・ACL・grantor・型・RLS設定・policy等のメタデータのみ。ユーザーUUID、走行記録行、JWT/APIキー/接続文字列/メール等をGitHub・チャットへ転記しない。

## 3. SQL全文（Q1〜Q4、各々独立、いずれも未実行）

### 1. Q1: 関数存在・所有者・security属性・生ACL

**提案用・未実行。** 原本SELECT文の前後に、各照会ごと独立したREAD ONLYトランザクションを付加。

```sql
BEGIN;
SET TRANSACTION READ ONLY;
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_userbyid(p.proowner) AS function_owner,
       p.prosecdef AS security_definer, p.proacl::text AS raw_acl
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'rings_now_snapshot_candidate_v01'
ORDER BY 1, 2, 3;
ROLLBACK;
```

### 2. Q2: 関数のACL明細（未作成なら0行想定）

**提案用・未実行。** 原本SELECT文の前後に、各照会ごと独立したREAD ONLYトランザクションを付加。

```sql
BEGIN;
SET TRANSACTION READ ONLY;
SELECT pg_get_userbyid(p.proowner) AS owner,
       COALESCE(r.rolname, CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE '(unknown)' END) AS grantee,
       a.privilege_type, a.is_grantable,
       pg_get_userbyid(a.grantor) AS grantor
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) AS a
LEFT JOIN pg_catalog.pg_roles AS r ON r.oid = a.grantee
WHERE n.nspname = 'public' AND p.proname = 'rings_now_snapshot_candidate_v01'
ORDER BY 2, 3;
ROLLBACK;
```

### 3. Q3a: デフォルトACL

**提案用・未実行。** 原本SELECT文の前後に、各照会ごと独立したREAD ONLYトランザクションを付加。

```sql
BEGIN;
SET TRANSACTION READ ONLY;
SELECT pg_get_userbyid(d.defaclrole) AS granting_role,
       COALESCE(n.nspname, '(global)') AS in_schema,
       d.defaclobjtype, d.defaclacl::text AS default_acl
FROM pg_catalog.pg_default_acl AS d
LEFT JOIN pg_catalog.pg_namespace AS n ON n.oid = d.defaclnamespace
WHERE n.nspname = 'public' OR d.defaclnamespace = 0
ORDER BY 1, 2, 3;
ROLLBACK;
```

### 4. Q3b: ロール属性

**提案用・未実行。** 原本SELECT文の前後に、各照会ごと独立したREAD ONLYトランザクションを付加。

```sql
BEGIN;
SET TRANSACTION READ ONLY;
SELECT rolname, rolcanlogin, rolsuper, rolbypassrls, rolinherit
FROM pg_catalog.pg_roles
WHERE rolname IN ('anon', 'authenticated', 'service_role', 'postgres', 'supabase_admin')
ORDER BY rolname;
ROLLBACK;
```

### 5. Q3c: ロールメンバーシップ

**提案用・未実行。** 原本SELECT文の前後に、各照会ごと独立したREAD ONLYトランザクションを付加。

```sql
BEGIN;
SET TRANSACTION READ ONLY;
SELECT parent.rolname AS granted_role, child.rolname AS member_role,
       m.admin_option, m.inherit_option, m.set_option
FROM pg_catalog.pg_auth_members AS m
JOIN pg_catalog.pg_roles AS parent ON parent.oid = m.roleid
JOIN pg_catalog.pg_roles AS child ON child.oid = m.member
WHERE parent.rolname IN ('anon','authenticated','service_role','postgres','supabase_admin')
   OR child.rolname IN ('anon','authenticated','service_role','postgres','supabase_admin')
ORDER BY 1,2;
ROLLBACK;
```

### 6. Q4a: runs RLS状態

**提案用・未実行。** 原本SELECT文の前後に、各照会ごと独立したREAD ONLYトランザクションを付加。

```sql
BEGIN;
SET TRANSACTION READ ONLY;
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='runs' AND c.relkind IN ('r','p');
ROLLBACK;
```

### 7. Q4b: runs RLSポリシー

**提案用・未実行。** 原本SELECT文の前後に、各照会ごと独立したREAD ONLYトランザクションを付加。

```sql
BEGIN;
SET TRANSACTION READ ONLY;
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname='public' AND tablename='runs'
ORDER BY policyname;
ROLLBACK;
```

### 8. Q4c: 6列の型とNULL許容

**提案用・未実行。** 原本SELECT文の前後に、各照会ごと独立したREAD ONLYトランザクションを付加。

```sql
BEGIN;
SET TRANSACTION READ ONLY;
SELECT a.attname, pg_catalog.format_type(a.atttypid,a.atttypmod) AS data_type,
       a.attnotnull AS not_null
FROM pg_catalog.pg_attribute AS a
WHERE a.attrelid='public.runs'::pg_catalog.regclass AND a.attnum>0
 AND NOT a.attisdropped
 AND a.attname IN ('id','user_id','activity_date','distance_km','started_at','deleted_at')
ORDER BY a.attnum;
ROLLBACK;
```

### 9. Q4d: schema USAGEとテーブルSELECT

**提案用・未実行。** 原本SELECT文の前後に、各照会ごと独立したREAD ONLYトランザクションを付加。

```sql
BEGIN;
SET TRANSACTION READ ONLY;
SELECT role.rolname, 
       pg_catalog.has_schema_privilege(role.oid,'public','USAGE') AS schema_usage,
       pg_catalog.has_table_privilege(role.oid,'public.runs','SELECT') AS runs_select
FROM pg_catalog.pg_roles AS role
WHERE role.rolname IN ('anon','authenticated','service_role')
ORDER BY role.rolname;
ROLLBACK;
```

## 4. Q5 画面閲覧のみ（未実施）
- 対象プロジェクト・参照IDと現在の実行環境の表示を照合。
- Data APIの公開スキーマ設定を閲覧し、`public`への公開有無や変更点を記録（画面の確定情報のみ）。
- Billing/Usage/Compute/Spend Cap/有料アドオン等を閲覧し、既存課金との差額と想定外の追加費用可能性を確認。変更・新規契約は禁止。
- 取得不能な情報は「未確認」。P1のゲートを無理に通さない。

## 5. 結果記録テンプレート（現時点NOT RUN）
- 対象ref一致：NOT RUN／実行ロール：NOT RUN／コスト再確認：NOT RUN。
- Q1 関数：NOT RUN／Q2 ACL：NOT RUN／Q3a,b,c：NOT RUN／Q4a,b,c,d：NOT RUN／Q5：NOT RUN。
- 各結果は「メタデータ確認・相違・未確認」のみ。照会回数と中止理由を併記。実際の照会結果を推測で埋めない。
- 追補58の未解決：`ownerScoped` のクライアント自己申告禁止、既存 `started_at IS NULL` による利用者単位遮断。P2/P3の別承認に持ち越す。
- **P1合格後もP2/P3は自動解禁しない。** 実Auth・HTTP・FIT・本番ONは未承認。

## 6. 本番不変条件／独立監査
`index.html` の `RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false` と `RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null`、PR #109 Draft/HOLD、iPhone優先、追加費用0円原則を維持。
本PRの差分は**新規文書1件だけ**。実Supabase接続/実SQL/DB変更なし、CI・SQL候補・公開コード・既存データには変更を加えない。

むせ監査観点：9本のSELECTがPR #158原文と**完全一致**し、各BEGIN/READ ONLY/ROLLBACKだけを付加していること、SQL Editorの挙動に関する過剰保証をしていないこと、ref/実行者/費用が追補60からの再利用情報として正確に区別されていること、P1承認を自動で得たと誤記していないこと、実行時停止条件・機密保持・不変条件があること。

**この文書はレビュー用。実行・マージはそれぞれAtsuoの別個の明示承認が必要。**
