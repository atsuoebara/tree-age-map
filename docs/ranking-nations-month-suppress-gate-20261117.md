# PR別件：既存NATIONS月間増加分の一時非表示案（2026-11-17）
## 状態
候補修正・レビュー用。**本番・Supabase・利用者データ未変更／SQL未適用／PRマージ禁止**。
Issue #205 / PR #206 の月間順位追加とは別の既存表示保護措置。

## 監査で確認された既存リスク
`ranking_nations_monthly` は既存の年間順位・年間距離・participants と一緒に `month_km` を全公開ロールへ返す。画面だけ隠してもRPC経路は露出する。2026-11-01 B-1 option C は別機能の初期数値公開見送り判断だが、既存ランキングの国別月間公開にも差分・少人数リスクがあるため、同等以上の慎重さを要求する。

## 本PRの候補差分
1. `ranking.html`: NATIONS専用の右端月間増加分を描画しない。説明は日英更新。旧NATIONSキャッシュを読み込み時破棄し、新しいRPCレスポンスも `month_km:null` にして表示/キャッシュ保管する。DISTANCE/EXPLOREは変更なし。
2. `supabase/ranking-nations-month-suppress-candidate.sql`: **本番には適用していない**。`CREATE OR REPLACE FUNCTION public.ranking_nations_monthly(integer,integer)` の戻り値と実行権限を維持しつつ、`month_km` だけ常時 `NULL::numeric` を返す。年間順位、年間km、年間participants、国順序、もとの集計対象は保持。既存 `supabase/ranking-monthly.sql` は触らない。
3. `scripts/test-ranking-nations-month-suppress-207.cjs`: 静的契約チェック。実PostgreSQLの同一スキーマでの回帰はむせ独立監査が必要。

## 注意
- **UIのみ先に公開してはならない**：既存RPCが数値を返す状態が続く。安全な切替順は独立監査→Atsuo明示承認→DB RPC置換→実HTTP anon/authenticated で `month_km:null` を確認→UI配信/キャッシュ消去確認。
- 単なる現時点の非表示は過去に公開されたレスポンス、スクリーンショット、外部保存データを削除できない。
- 年間NATIONSの `km` と `participants` は従来どおり公開し続けるため、更新差分や1人国の情報推測リスクが完全に消えたとは言えない。既存の年間公表方針は別途Atsuo判断。
- 古いSQLを後から再適用すると `month_km` が復活する（DB変更の競合）。マイグレーション順序・将来再適用防止を監査する。
- アプリ側でキャッシュ削除に失敗しても `month_km` を再表示しない。JavaScriptの配布前キャッシュやService Workerなどの配信整合性は別途確認。

## むせへの独立監査（必須）
1. 差分境界とPR #206独立性・本番無変更を照合。
2. PostgreSQL実行で既存 `ranking_nations_monthly` との年間列全一致、月間列 NULL、署名/権限/owner/security definerの保持、0件/複数国/少人数で検査。
3. anon/authenticatedの実HTTPで `month_km` 非公開（本番ではなく隔離環境）、旧月間経路や他の公開RPC・キャッシュで同値が取れないかを監査。
4. 375px、日英、年/月変更、共有画像、順位検索、ロード・エラー・応答競合をブラウザ確認。
5. 年間km・participantsの公開による間接推定リスクとB-1判断の境界を別途報告。
6. 結果は合否と観察を分ける。現時点ではレビュー完了・マージ・DB適用・本番ONを意味しない。
