# PR #212 — 月間モードONの合成ブラウザ検査（2026-11-17）

## 境界
この検査は **テストプロセスのメモリ内** に限り `ranking.html` の `RANKING_MONTH_PLACES_ENABLED=false` を `true` に置き換え、Chromiumへ供給する。**Git管理下の本物のHTMLは一切書き換えず、本番スイッチはOFFのまま**。Supabase SDKは架空の配列を返すモックに差し替え、実Supabase/実HTTP/ユーザーデータへアクセスしない。

## 期待する動作
- 合成ON状態では月間モードボタンが押せる。月間DISTANCEは `ranking_distance_month_places`、月間EXPLOREは `ranking_explore_month_places` だけを呼び、月間用の順位・数値を表示する。二重の「月間増加分」セルは描かない。
- 月間NATIONSは案内文だけ表示。新しい `ranking_nations_month_places` は決して呼び出さない。
- 年／月／英語の切替で候補RPCに正しい年・月を渡す。
- 年間モードに戻すと従来の年間RPCを利用。NATIONSの架空応答に `month_km:999.9` を含めても、セルは表示されずローカルキャッシュは `NULL` にされる。
- 遅い年間RPCが月間表示の後に完了しても、現在の月間表示を上書きしない。375px横はみ出しなし、実行時エラーなし。

## リリース禁止条件
このテストは**架空データによるON導線の動作**を試すだけ。実DBでPR #206の新RPCが有効であること、本人の公開設定、認証/匿名HTTP、実iPhone Safari、共有画像や全てのエラー条件を証明しない。今回のテスト用ON状態を本番の定数へ反映してはならない。

PR #208の実DB月間NULL切替→anon/authenticated実HTTP確認→UI配信という順序と、PR #206の新RPC適用・月間ONの別途Atsuo承認が必要。PR #212はmainへ直接マージしない。

## むせ監査
- 変更は合成ONテスト、CI接続、検証文書のみ（`ranking.html`/SQL無変更）。
- 実行ログとHEAD SHAを照合。ON化がメモリ内だけであること、SDK外部遮断とNATIONS保護を監査。
- 成否はGitHub Actionsの実結果を確認してから判定。失敗時は原因を分析し再監査。
