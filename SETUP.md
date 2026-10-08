# 差し替え手順

GitHub の最新 index.html、gps-art.html、ROADMAP.md を取得して作成しました。

1. index.html と gps-art.html を同名ファイルへ全文差し替えします。
2. ROADMAP.md を差し替えます。
3. ページを更新し、ログイン前・ログイン後の入口、日本語・ENの表示を確認します。

別スレでこの取得後に index.html を更新した場合は、古いファイルへ戻さず、最新版との統合が必要です。
今回の index.html はスクリプトを変更していません。

Supabase の追加操作は不要です。診断と交差補正の v17 は反映済みです。
supabase/gps-art-generate.ts は、反映済みサーバーコードの保管用です。再デプロイ不要です。
保存・投稿・コメント機能は追加していません。

Commit message: Add GPS art beta entry and generation notices
