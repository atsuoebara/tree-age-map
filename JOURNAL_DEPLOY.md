# Journal 即時公開導入手順（コードだけでは未稼働）

1. この変更を GitHub `main` に反映する。`index.html` と Steve の記事は変更していない。
2. GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens で `atsuoebara/tree-age-map` のみ、Repository permissions: Contents **Read and write** の期限付きトークンを発行する。**トークンをチャットやGitHubのコードに貼らない。**
3. Supabase → Edge Functions → Secrets で `GITHUB_JOURNAL_TOKEN` にトークンを登録。Supabase CLI を使う場合: `supabase functions deploy journal-trigger` （JWT verification ON）。Dashboardから関数を作る場合は `supabase/functions/journal-trigger/index.ts` を登録し、JWT verification ON。
4. Supabase の `journal_posts` 管理者向け RLS が `DELETE` を許可しているか確認する。**既存RLSを無条件に緩めない。** 許可されていなければ管理者 `auth.uid()` に限定した DELETE policy を追加する（既存ポリシーを先に確認）。
5. 本番で新規記事を公開し、Actions に `journal-content-changed` 実行が追加されるか確認。起動できなければ手動の Run workflow（dry_run=false）で復旧可能。
6. ID5「Journal 自動公開テスト」を削除する前に、画面が示すタイトルを照合。削除後、GitHub Actions 完了・ページが404・一覧から消えたことを確認。**ID4（Steve）には触れない。**

補足：GitHub Actions の cron は予備として残す。Edge Function が公開/削除後に GitHub API に即時通知する。公開画面にはGitHubトークンを置かない。DB操作が成功して通知に失敗した場合は警告を表示し、手動再生成できる。旧生成ページも、固定の生成ページ形式とcanonical URLが一致した場合だけ削除する。
