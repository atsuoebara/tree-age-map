# Garmin one-shot形状検査：本番スキーマと隔離模型のギャップ（2026-11-13）

状態：**読み取り専用の本番カタログ照合／本番変更ゼロ／設計監査資料**。対象は Supabase `public.runs`, `public.garmin_api_connections`, `public.garmin_activity_inbox` の `pg_attribute` / `pg_constraint` とGitHub `main` のGarmin受信SQL・PR #67のCI模型。行本文・ユーザーID・GPS・Secretは取得していない。

## 1. 型と制約の事実（実DBのカタログ照合）
| 対象 | 本番 | 隔離模型とのギャップ／対策 |
|---|---|---|
| runs.id | bigint PK | 模型のrun_ref textとは異なる。型一致と実FKが必要 |
| runs.user_id | uuid **NULL許容**, FK auth.users(id) **ON DELETE CASCADEなし** | 模型のowner_ref NOT NULL・connectionへのcascadeだけでは、本番のユーザー削除が再現できない。新しい結果レコードではowner必須、本人一致を厳格化 |
| runs.deleted_at | timestamptz NULL許容 | soft-deleteをトリガ/サーバ再検証で拒否・削除する必要 |
| runs.source / source_external_id / started_at | text / text / timestamptz（いずれもNULL許容） | Garmin真正ID・走行開始日時の照合はDBが無条件で保証しない |
| garmin_api_connections.user_id | uuid PK、auth.users(id) FK ON DELETE CASCADE | 同じ所有者でも再接続で世代が変わる。ユーザー削除時の接続削除と結果削除の順序を別監査 |
| garmin_api_connections.connection_version | uuid NOT NULL default gen_random_uuid() | 模型のgeneration textとは型が異なる。UUID厳密照合 |
| garmin_api_connections.import_enabled / permissions | boolean NOT NULL / jsonb NOT NULL | 本番権限の判定は `garmin_has_export` 相当の正式処理を再利用。模型のboolean export_allowedとは別 |
| garmin_activity_inbox.user_id / connection_version | uuid NOT NULL / uuid NULL許容 | inboxが旧世代/NULLの場合のデータ拒否と整合。保存成功後のpayloadは消去済 |
| garmin_activity_inbox.payload | jsonb NOT NULL | 処理済40件で空だった過去確認。実サンプルの形状を証明しない |
| run_race_analysis | **実DBカタログに存在しない** | PRのschema-review.sqlは未適用。これを使った本番動作を宣言しない |
| 検査用one-shot/probeテーブル | **今回の本番カタログ対象には存在を確認していない** | テストの`probe_ci`と`probe_scope`はGitHub CI専用。実DB上に設置されたものではない |

実DBの制約（抜粋）：`runs_pkey(id)`、`runs_user_id_fkey -> auth.users(id)`（CASCADEなし）、`garmin_api_connections_pkey(user_id)`、`garmin_api_connections_user_id_fkey -> auth.users(id) ON DELETE CASCADE`、`garmin_activity_inbox_user_id_fkey -> auth.users(id) ON DELETE CASCADE`、`garmin_activity_inbox_user_id_summary_id_key UNIQUE(user_id,summary_id)`。**run所有者とGarmin接続世代を複合で拘束する既設FKはない**。

## 2. 既存の関係と観測
- `garmin_cancel_queue` は接続削除/世代変更/権限取消/取り込み停止時に受信箱を空にする。**未来の新設検査テーブルを自動的に消すものではない**。
- `garmin_commit_activity` は connection を先にロックし、inboxを次にロックしてrunを保存、完了時にpayloadを消す。今後新設する消去・保存処理はこのロック順を破らず、既存年輪保存の成功可否を変えないこと。
- `runs`にはB1匿名集計・Today同期のトリガーが既にある。新設消去トリガーで既存更新処理を壊さないこと。
- 合成3所有者の隔離テストのPASSは**実DBの型、NULL、実ロール/RLS、実接続失効、ユーザー削除、障害時ACK**のPASSを意味しない。

## 3. 本番に接続する前のハードゲート（優先順）
1. **本番と同型の隔離モデル**：uuid user_id/connection_version、bigint run_id、NULL許容run.user_id、既存FKの非cascadeを模型化。所有者NULL・不一致・非Garmin・旧世代・soft deletedをfail closed。実ユーザーデータ使用禁止。
2. **保存経路の証明**：Garmin本人接続・受信活動ID・接続世代・run IDに紐づくサーバのみの取得。クライアント提供サンプルとmetadataの突合だけで真正性確定としない。
3. **削除/失効と競合**：実際の既存テーブル構造に近い隔離スキーマで、複数ユーザー、同一ユーザー複数ラン、run soft/physical delete、アカウント削除、再連携、権限取消、同時finish/revoke、早遅順を証明。必要な所有者複合FKは設計レビュー。
4. **権限/コスト/プライバシー**：service_roleだけの書込み、本人だけの読取り、見えない結果の速やかな削除、TTL/バックアップの限界、追加費用0円を監査。
5. **先に実payload shape**：現在のGarmin Pushに時刻・累積距離・任意心拍が存在する証拠なし。匿名の公式fixture入手が優先。実受信検査はむせ事前監査とオーナー明示承認が必要。
6. **本人仕様**：ガチラン限定、本人が選ぶ1回のラン、診断期限は**走行開始から8日**、結果は画像で本人保存/共有、年輪は消さない。

## 判定
**本番スキーマ差分の洗い出し＝完了。単純な隔離模型をそのまま本番適用＝No-Go。** 実DBと同型の隔離fixtureを用意し、独立監査→本人明示承認まで本番DB・receiverを一切変更しない。#67 Draft、#68 HOLD。
