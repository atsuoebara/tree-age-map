# Rings Now — P1実Supabase読み取り専用カタログ調査の事前計画（未承認・実行禁止）

2026-11-15。基点：PR #157 マージ済。**本書はP0設計資料。Supabaseへの接続もSQLの実行も行っていない。**
次のP1は、対象プロジェクト、実行者、照会SQL全文、出力の扱い、費用・中止条件を本人が**別途明示承認**するまで実施しない。PRの監査・マージだけではP1は解禁しない。

## 0. 既存証拠と不足
PR #155・#156はPostgreSQL 17合成環境の名前付きEXECUTE、REVOKE、本人分離、NULL、1000/1001件等の動作確認。実Supabaseのロール所有・継承・ACL・Auth・PostgREST・実RLS・同時更新・負荷・料金は未検証。PR #157のR1〜R5、A1〜A6の承認境界を引き継ぐ。

## 1. P1で提案する調査境界
1. 対象：本人が明示指定した**単一の既存Supabaseプロジェクト**に限る。Project ID、環境、DB接続権限、実行ロールを実行前に突き合わせる。別環境を新規作成しない。
2. 操作：管理カタログの**SELECTのみ**。行データを返す `public.runs` の SELECT、RPC呼出し、PostgREST実呼出し、実JWT使用、DDL/DML/GRANT/REVOKE、EXPLAIN ANALYZE、負荷試験は禁止。候補 `docs/rings-now-single-statement-snapshot-CANDIDATE.sql` は変更SQLなので**実行禁止**。
3. 記録：ロール名・権限・型・真偽値・件数などのメタデータだけ。トークン、接続文字列、利用者のUUID、ランの行値、メール、ログ中の秘密をGitHubやチャットへ載せない。
4. 安全：想定外のプロジェクト/実行主体・機密表示・長時間実行・課金可能性・予期せぬ権限不足のどれかで**中断し、推測で補完しない**。SQL Editor自体が対象DBへ接続するので別承認必須。

## 2. 読み取り照会案（レビュー用・このPRでは未実行）
**照会前提**：各SQLを事前レビューし、P1承認で具体的なSQL本文と実行環境が指定された場合のみ使用。利用者データ行にアクセスしない。

### Q1: 関数の存在・所有者・security属性・生ACL
```sql
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_userbyid(p.proowner) AS function_owner,
       p.prosecdef AS security_definer, p.proacl::text AS raw_acl
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'rings_now_snapshot_candidate_v01'
ORDER BY 1, 2, 3;
```
存在しなければ「未作成」と記録し、実適用後ACLの証拠として代用しない。

### Q2: 関数のACL明細（存在する場合のみ）
```sql
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
```
`proacl IS NULL`は「権限なし」を意味しない。デフォルト権限・所有者・PUBLICや継承を別途解釈する。

### Q3: デフォルトACL・ロール属性・メンバーシップ
```sql
SELECT pg_get_userbyid(d.defaclrole) AS granting_role,
       COALESCE(n.nspname, '(global)') AS in_schema,
       d.defaclobjtype, d.defaclacl::text AS default_acl
FROM pg_catalog.pg_default_acl AS d
LEFT JOIN pg_catalog.pg_namespace AS n ON n.oid = d.defaclnamespace
WHERE n.nspname = 'public' OR d.defaclnamespace = 0
ORDER BY 1, 2, 3;
```
```sql
SELECT rolname, rolcanlogin, rolsuper, rolbypassrls, rolinherit
FROM pg_catalog.pg_roles
WHERE rolname IN ('anon', 'authenticated', 'service_role', 'postgres', 'supabase_admin')
ORDER BY rolname;
```
```sql
SELECT parent.rolname AS granted_role, child.rolname AS member_role,
       m.admin_option, m.inherit_option, m.set_option
FROM pg_catalog.pg_auth_members AS m
JOIN pg_catalog.pg_roles AS parent ON parent.oid = m.roleid
JOIN pg_catalog.pg_roles AS child ON child.oid = m.member
WHERE parent.rolname IN ('anon','authenticated','service_role','postgres','supabase_admin')
   OR child.rolname IN ('anon','authenticated','service_role','postgres','supabase_admin')
ORDER BY 1,2;
```
PGバージョン差でカラム未対応なら中止して照会案を再監査する。**生ACLだけで実効ACLは結論しない**。

### Q4: runsのRLS/ポリシー/6列型・列権限とschema USAGE
```sql
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='runs' AND c.relkind IN ('r','p');
```
```sql
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname='public' AND tablename='runs'
ORDER BY policyname;
```
```sql
SELECT a.attname, pg_catalog.format_type(a.atttypid,a.atttypmod) AS data_type,
       a.attnotnull AS not_null
FROM pg_catalog.pg_attribute AS a
WHERE a.attrelid='public.runs'::pg_catalog.regclass AND a.attnum>0
 AND NOT a.attisdropped
 AND a.attname IN ('id','user_id','activity_date','distance_km','started_at','deleted_at')
ORDER BY a.attnum;
```
```sql
SELECT role.rolname, 
       pg_catalog.has_schema_privilege(role.oid,'public','USAGE') AS schema_usage,
       pg_catalog.has_table_privilege(role.oid,'public.runs','SELECT') AS runs_select
FROM pg_catalog.pg_roles AS role
WHERE role.rolname IN ('anon','authenticated','service_role')
ORDER BY role.rolname;
```
行の中身を読まない。結果だけではJWTを伴うRLSが正しく機能した証拠にはならない。

### Q5: PostgREST公開設定と費用
Data APIの公開スキーマ・設定は**設定画面/公開ドキュメントでまず確認**し、未確認の場合は未証明と記録。実HTTPリクエストはしない。既存Pro枠、ログ、バックアップ、ストレージ、追加環境、Actions使用量、課金上限を事前照合し、追加費用0円を示せないならP1でも保留。画面閲覧でプロジェクト接続が必要ならその操作自体もP1承認の対象。

## 3. P1報告フォーマット
- 事前承認記録と対象確認：未承認なら **NOT RUN**。
- R1 対象とロール：確認/不一致/未確認。
- R2 ACL・所有者・メンバーシップ：確認/差異/未確認（関数未作成ならその旨）。
- R3 列・RLS・権限：確認/差異/未確認。
- R4 公開設定：確認/未確認（実HTTPは未実施）。
- R5 費用・影響：追加費用0円の根拠/不足。
- 結論：**P1合格でもP2実行やP3本番ONは自動解禁しない**。実Supabase実装の安全性・一貫性・性能は引き続き未証明。

## 4. 追補58の観察（P2以降に持ち越す）
- PR #153のパーサー接続ではRPCの返却データ経路を明示し、`ownerScoped`のクライアント自己申告を信用せず、サーバー側の所有者確認とセッション世代ガードを独立試験する。
- 現存の未削除 `started_at IS NULL` レコードによる利用者単位の全件遮断は、P2報告・P3判断の宿題として明示。**個別承認なくデータ修正や遮断緩和をしない**。

## 5. 不変条件と監査依頼
- PRは**新規文書1ファイルだけ**。SQL候補、実DB、公開HTML、index.html、sw.js、CIワークフロー、カレンダー、解析エンジン、実FITに変更なし。
- `RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false`、`RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null`、PR #109 Draft/HOLD。iPhone優先、開始時刻から8日、停止を含む経過時間、追加費用0円を維持。
- むせ監査：照会案が読み取り専用であるか、所有者/デフォルトACL/継承/実効権限の区別があるか、実Supabase未証明の明記、P1本人承認の独立性、情報非公開・費用ゲートを確認。

**この文書のPRのマージ承認はP1の承認ではない。実Supabaseへのアクセス・SQL実行・Auth/HTTP/FIT・DB変更・本番ONは一切禁止。**
