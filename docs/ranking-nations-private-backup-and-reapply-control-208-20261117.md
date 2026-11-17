# PR #208 — 非公開バックアップと再適用防止：運用チェックリスト（2026-11-17）
状態: **手順設計のみ・実施承認なし**。本番関数の保存、DB変更、PRマージ、UI配信をこの文書の作成で実施したとは扱わない。

## 背景
既存 `public.ranking_nations_monthly(integer,integer)` は国別の `month_km` を公開RPCで返している。候補SQLは月間だけ `NULL::numeric` にする。後日古い `supabase/ranking-monthly.sql` を再適用すると再公開するため、旧SQLを戻す「単純ロールバック」は**禁止**。年間 `km` / `participants` は別途公開判断が必要。

## A. 関数の非公開スナップショット取得（実行前に別途Atsuo承認）
1. 適用直前の読取専用プリフライト `scripts/ranking-nations-preapply-readonly-208.sql` を本番対象projectで実行し、**返却1行かつ全ブール値true**、MD5 `a7c4bf3f7944f2d1c3bb872d79f406b4` を確認。いずれか不一致なら停止・再監査。
2. 認証済み管理者が**privateな管理環境**で対象関数定義と実際の所有者・ACL・属性（SECURITY DEFINER / STABLE / search_path）を読み取り、非公開の限定アクセス領域へ保存する。例として、関数定義を読むSQLは以下。**クエリ結果をGitHub、チャット、公開ログ、CI artifact、Journal、スクリーンショットへ貼らない**。管理者が保存したかどうかだけを非機密な実施記録に書く。
   ```sql
   SELECT pg_get_functiondef('public.ranking_nations_monthly(integer,integer)'::regprocedure);
   SELECT p.proacl, pg_get_userbyid(p.proowner) AS owner_name, p.proconfig,
          p.prosecdef,p.provolatile
   FROM pg_proc p
   WHERE p.oid='public.ranking_nations_monthly(integer,integer)'::regprocedure;
   ```
3. バックアップ実物が再取得可能か、保存権限・暗号化・保管期限・アクセス者・削除手順を私的に確認。公開の監査記録には「取得確認」および照合MD5・確認者・日付のみ記載。**まだ取得した事実はない**。
4. バックアップはあくまで復元のための参照。**旧関数をそのまま本番へ戻すことは不可**（国別月間距離が再公開されるため）。

## B. 旧SQL再適用を防ぐ運用ルール
1. `supabase/ranking-monthly.sql` は「履歴・参照用、全体の本番再適用禁止」と扱う。今後の年間/NATIONS修正は現行運用状態を再取得し、`month_km:NULL` を不変条件にした新しい差分候補として独立監査を行う。
2. 本番SQL適用を行う人は、SQLのファイル名・Git SHA・実行環境・対象関数・差分・レビュー者・承認番号を先に記録する。ファイル全体の一括再適用ではなく対象の監査済みSQLのみを使用。
3. CI候補 `ranking-nations-month-exposure-guard.yml` は**GitHub上のPRの静的な変化を検知するだけ**。Supabase Dashboardでの手動実行、他の管理権限、他のworkflowの適用までは防げない。DB管理権限・運用ルール・人手のダブルチェックで抑止し、完全防止と称さない。
4. 適用作業直前および終了直後に関数のハッシュ・公開RPC月間NULL・年間列一致を確認。意図せず旧SQLが再適用されたらランブックに従い公開経路遮断→NULL版再適用→実HTTP再検証→記録。月間値を再公開する旧版への復旧は禁止。

## C. 記録の最小テンプレート（非機密項目だけ）
- 実施予定段階（DB候補適用 / 実HTTP検証 / UI配信）:
- 対象Git SHAとPR:
- 対象環境（環境名まで。接続情報なし）:
- 適用前の関数定義MD5一致: YES / NO / NOT RUN
- 限定アクセスの非公開バックアップ存在・読取確認: YES / NO / NOT RUN
- ACL/owner/依存関係確認: YES / NO / NOT RUN
- 旧SQL再適用を防ぐ運用担当・確認者: （秘密情報なし）
- Atsuoによる**この段階の**明示承認: YES / NO
- DB検証の月間NULLと年間不変: YES / NO / NOT RUN
- anon/authenticated実HTTP: YES / NO / NOT RUN
- ブラウザ375px・日英・検索・共有・SW/キャッシュ: YES / NO / NOT RUN
- 残留年間集計の推測リスクを「解消」と宣言していない: YES / NO

**NO/NOT RUNが必須ゲートに残れば次段階へ進まない。**

## D. むせへの監査
文書が非公開保存物をGitHubへ追加しないこと、バックアップから公開旧SQLに復元しないこと、CIと運用上の権限境界を区別すること、PR #208ランブックのDB→HTTP→UIを保つことを確認。文書だけの監査合格を本番適用の承認に読み替えない。

現在: **バックアップ未作成／本番SQL未適用／main未マージ／UI未配信**。
