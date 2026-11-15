# Rings Now P2 — 実行承認パッケージ v0.1（文書のみ・未承認）

作成日: 2026-11-16。根拠: 2026-11-15 追補73（P2設計監査合格）、PR #157〜#159、P1追補71。状態: **REVIEW ONLY / NOT RUN / P2 NOT APPROVED**。

## 0. 承認境界
Atsuoの承認はこの文書の作成だけ。ローカルSupabase起動、Docker/CLI実行、SQL適用、DB変更、Auth/JWT/HTTP試験、実FIT、本番接続・本番ON、マージは一切未承認。文書レビュー・監査・マージは実行承認を意味しない。Rings Nowの一時停止は維持。

## 1. 対象と取り違え防止
対象リポジトリ: atsuoebara/tree-age-map。候補原本: `docs/rings-now-single-statement-snapshot-CANDIDATE.sql`、取得時blob SHA `c8bb8bfdeb1e2e88bea422aa76c27d094127bdea`。実行対象の候補は原本とバイト照合し、差異があれば停止。P2の唯一の想定先は **ローカルSupabase CLI＋Docker**。本番プロジェクト `fhwvntpzwyenendhcgbw` は照合用識別子であって接続先ではない。ローカルであることをホスト・URL・プロジェクトref・認証情報の種別で確認する手順を実行前監査で確定する。外部環境や本番の認証情報を流用しない。

## 2. 実行環境・費用ゲート（未確定）
ローカル実行者・マシン・CLI/Dockerバージョン・PostgreSQL/PostgREST/Authバージョン・リソース上限・データ隔離・ネットワーク遮断/接続方針は **TBD**。実行環境の証拠なしに承認不可。GitHub Actionsを使う場合、無料枠・課金設定・利用時間の証拠をA5に追加し、事前に別承認を得る。追加固定費・新規プロジェクト・Branching・有料アドオンは不可。既存Supabase料金の定例再確認は不要（請求面が変わる操作または木曜巡回異常時のみ）。

## 3. P2実施計画 A1〜A6（全項目 NOT RUN）
| ゲート | 試験と合格条件 | 結果 |
|---|---|---|
| A1 実環境 | ローカルSupabaseの実ロール・Auth・PostgRESTが動作し、本番に通信しないことを証明。実JWTで本人/他人/無認証を分離。RPC実出力を #153 パーサーへ通し、`ownerScoped` のクライアント自己申告を信頼しないことを検証 | NOT RUN |
| A2 ACL/RLS | 候補適用直後の `pg_proc.proacl` 生値、実効EXECUTE、owner、RLS、anon/authenticated/service_roleの挙動を確認。service_roleのRLS迂回とRPC実行権限を混同しない | NOT RUN |
| A3 境界・形式 | 0/1000/1001件、NULL必須項目、削除済み、他人、重複・順序・余分な項目、6桁小数秒と8日境界、応答のパーサー全体遮断を確認。実RPC出力→#153パーサー経路を再確認 | NOT RUN |
| A4 一貫性・復旧 | 同時更新時の単一文スナップショットの範囲・限界を記録。適用前後の権限・関数状態を比較し、ロールバック手順と復元結果を実証 | NOT RUN |
| A5 費用・性能 | ローカル資源消費・代表的実行計画・遅延の目安を測定。追加費用0円の根拠を示す。Actions利用時は課金根拠を事前提示。本番Micro性能の証明とはしない | NOT RUN |
| A6 証拠・停止 | 実行ログ、環境同定、SQL原本ハッシュ、合否・異常・中止理由を記録し、秘密情報/実利用者データを保存・公開しない。1件でも未証明ならP2不合格/保留 | NOT RUN |

## 4. SQL原文（照合用・実行禁止）
下記はGitHub mainから取得した候補SQLの原文。**この文書から実行しない**。実行手順とロールバックは別途独立監査後に確定する。

```sql
-- Rings Now REVIEW CANDIDATE ONLY. DO NOT EXECUTE OR DEPLOY.
-- This file includes an UNEXECUTED transactional ACL proposal; no DB changes occur.
-- Applying this SQL requires separate explicit owner approval and staging proof.
-- Column types and RLS predicates checked read-only 2026-11-15; actual JWT/ACL, costs and performance remain UNVERIFIED.
-- A read-only COUNT found one undeleted started_at NULL in 25,942 rows;
-- no identity, row values, or per-user ownership were obtained.
--
-- One PostgreSQL statement uses one MVCC statement snapshot, in contrast to
-- multiple OFFSET calls or two independent reads. This is a design hypothesis
-- to verify in staging with an authenticated client, not proof of production safety.
--
-- SECURITY INVOKER: never grant this function to anon or bypass RLS.
-- The caller still MUST invalidate responses after logout/session rotation.
-- If separately approved, CREATE/REPLACE and privilege narrowing MUST be
-- executed in the same transaction to avoid an intermediate PUBLIC EXECUTE window.
-- CREATE OR REPLACE retains previous ACLs, so defaults cannot be assumed safe.
BEGIN;
CREATE OR REPLACE FUNCTION public.rings_now_snapshot_candidate_v01()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $rings_now_candidate$
  WITH owner AS MATERIALIZED (
    SELECT auth.uid() AS uid
  ),
  sampled AS MATERIALIZED (
    SELECT r.id, r.user_id, r.activity_date, r.distance_km,
           r.started_at, r.deleted_at
    FROM public.runs AS r
    WHERE r.user_id = (SELECT uid FROM owner)
      AND r.deleted_at IS NULL
    ORDER BY r.id ASC
    LIMIT 1001
  ),
  count_check AS MATERIALIZED (
    SELECT count(*) AS total FROM sampled
  ),
  required_null_check AS MATERIALIZED (
    SELECT count(*) FILTER (
      WHERE activity_date IS NULL
         OR distance_km IS NULL
         OR started_at IS NULL
    ) AS invalid_total
    FROM sampled
  ),
  safe_rows AS (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'user_id', user_id,
          'activity_date', activity_date,
          'distance_km', distance_km,
          'started_at', started_at,
          'deleted_at', deleted_at
        ) ORDER BY id ASC
      ),
      '[]'::jsonb
    ) AS rows
    FROM sampled
    WHERE (SELECT total FROM count_check) <= 1000
      AND (SELECT invalid_total FROM required_null_check) = 0
  )
  SELECT CASE
    WHEN (SELECT uid FROM owner) IS NULL
      THEN jsonb_build_object('status','blocked','reason','unauthenticated')
    WHEN (SELECT total FROM count_check) > 1000
      THEN jsonb_build_object('status','blocked','reason','too_many_rows')
    WHEN (SELECT invalid_total FROM required_null_check) > 0
      THEN jsonb_build_object('status','blocked','reason','missing_required_fields')
    ELSE jsonb_build_object('status','candidate_snapshot','rows',
                           (SELECT rows FROM safe_rows))
  END;
$rings_now_candidate$;

-- PostgreSQL normally grants function EXECUTE to PUBLIC unless revoked.
-- Explicitly revoke inherited/default access; allow only authenticated role.
-- Do not assume REVOKE blocks superusers, function owner or service_role RLS bypass.
REVOKE ALL ON FUNCTION public.rings_now_snapshot_candidate_v01() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rings_now_snapshot_candidate_v01() FROM anon;
REVOKE ALL ON FUNCTION public.rings_now_snapshot_candidate_v01() FROM service_role;
GRANT EXECUTE ON FUNCTION public.rings_now_snapshot_candidate_v01() TO authenticated;
COMMIT;

-- This is a DESIGN, not evidence of an applied or effective ACL.
-- BEFORE any use check pg_proc.proacl, pg_has_role/has_function_privilege,
-- effective role membership, authenticated JWT, owner/table privileges and RLS,
-- whether PostgREST exposes the RPC, and service-role bypass.
-- Before adoption: independently check RLS policy on public.runs, actual
-- return column types, service-role bypass, a real JWT, permissions,
-- 1000/1001 boundary, performance, plan pricing and failure conditions.
```

## 5. ロールバック計画（設計、NOT RUN）
ローカル環境の初期状態・関数/ACL/ロール・データを先に記録し、テスト専用の破棄可能な環境だけで候補適用を行う想定。テスト後はローカル環境を破棄/再生成し、関数不存在、権限・ポリシー・データの初期状態への復帰を検証する。コマンド・責任者・復元証拠・停止条件は実行前に監査確定。**本番でDROP/ROLLBACKする計画ではない**。

## 6. 未決定・P3へ持ち越し
本番適用の位置付け（P3冒頭か独立ゲート）、本番適用主体・関数owner、started_at NULLの利用者1名の扱い（現行は全体遮断を維持）、本番Data API露出、実データ・Micro性能、実セッション/実FIT/開始時刻/公開範囲は未決定。P2合格は本番適用・P3・本番ONの承認を一切与えない。旧完了チェックリスト14条件/12項目をP2合格だけで「済み」にしない。

## 7. 結果記録テンプレート
環境識別: NOT RUN / SQL SHA照合: NOT RUN / A1: NOT RUN / A2: NOT RUN / A3: NOT RUN / A4: NOT RUN / A5: NOT RUN / A6: NOT RUN / ロールバック: NOT RUN / 追加費用根拠: NOT RUN / 中止理由: NOT RUN / 独立監査: NOT RUN / Atsuo P2実行承認: **NO**。

## 8. むせへの設計監査依頼
文書のみの差分、候補SQLのバイト一致、A1〜A6の合否条件、追補58の宿題、実行環境と費用の未決定表示、ロールバックと本番分離、未承認操作を確認してください。**試験・SQL実行・デプロイ・マージはしないでください。**
