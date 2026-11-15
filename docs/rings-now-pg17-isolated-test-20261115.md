# Rings Now — PostgreSQL 17 隔離SQL実行テスト（2026-11-15）

## 目的と範囲
新たなSupabaseプロジェクトや実ランを使わず、既存GitHub ActionsのPostgreSQLサービス方式を借用し、postgres:17の一時コンテナに**模擬** auth.uid / RLS / 権限 / runs の小型スキーマを作る。mainのレビュー用候補SQL `docs/rings-now-single-statement-snapshot-CANDIDATE.sql` を**一時コンテナにだけ**実行し、SQL文として動くことと権限・レスポンス境界を確認する。

- 一時DB名 `rings_now_synthetic`、ユーザー `rings_fixture`、PGHOST localhost。workflowは環境チェックに失敗したら実行しない。
- 模擬role `anon` / `authenticated` / `service_role` と、模擬auth.uid()を使用。JWTクレームはセッション変数で**作り物**を設定するもので、Supabase Auth JWT / PostgREST / 実RLS権限の証明ではない。
- 架空の固定UUIDとランのみを使用。実ユーザー・実ラン・機密情報・実JWTを一切読み込まない。
- SQL候補は**元ファイルをそのまま**読み込み、差異のある手書きの簡易関数で代替しない。
- テスト: SQL作成・SECURITY INVOKER、PUBLIC/anon/service_roleのEXECUTE遮断、authenticated許可、本人と他人の分離、削除済み除外、無認証遮断、NULLの理由付き全件遮断、0件、1000件、1001件、NULLと上限の優先順位、6列のみのJSONを検証する。
- ワークフローのCIはGitHub Actionsの利用枠を消費し得る。実行無料枠・課金設定・追加費用0円は未証明。新規インフラ契約は作らない。

## 限界
これは**一時的なローカルPostgreSQL 17の模擬実行**であり、Supabase本番DBにもステージング実DBにも一切接続しない。実JWT/失効、実PostgREST、実効RLS、性能・料金、実DBでの同時更新・MVCC一貫性、iPhone実機、FIT連携、実カレンダーは未検証。適用の承認を意味しない。

## 実施条件
- mainへのマージはむせ独立監査とAtsuoの明示承認が必要。
- index.html、sw.js、公開ページ、既存DB、本番入口OFF、開始時刻null、PR #109 Draft/HOLDに変更を加えない。
- 本番SQL適用・既存DB変更・実Auth・実HTTP・実FIT・本番ONなし。

## 2026-11-15 追補：Supabase型の明示的EXECUTEデフォルト権限を模擬
- 旧テストは標準PostgreSQLのPUBLIC EXECUTE経由の遮断を証明していたが、実Supabaseで見つかった`supabase_admin`等によるデフォルトACLの**3ロールへの明示付与**は再現していなかった。
- 今回は一時コンテナの`rings_fixture`作成関数について、`ALTER DEFAULT PRIVILEGES ... GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role`を設定。検査用の一時関数で、3ロールへの名前付きgrantが実際に付いていることを`aclexplode(proacl)`で**先に検証してから**既存の候補SQLをそのまま適用する。
- 適用後、`pg_proc.proacl`を展開し`PUBLIC`・`anon`・`service_role`のEXECUTE項目が消え、`authenticated`が残ったことを確認。従来の`has_function_privilege`による実効権限確認も残す。
- これは**架空DBでのSupabase型ACL模擬**であり、Supabase実環境の`proacl`、role membership、関数所有者、PostgREST、実JWT、実RLSの実証ではない。実DBへのSQL適用は別承認が必要。
- 候補SQL・本番DB・本番入口・開始時刻・PR #109には変更しない。GitHub Actionsの利用枠の課金条件も別途確認事項。
