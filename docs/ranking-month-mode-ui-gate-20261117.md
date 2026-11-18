# Issue #205 — 月間順位 UI モード（PR #206に積む候補）
日付 2026-11-17

## 依存とHOLD
このブランチは **PR #206 のブランチ** `feature/ranking-monthly-places-205` から派生する。mainには直接積まない。月間新RPCは現時点では実Supabase未適用。本番・mainへのデプロイは禁止。

`ranking.html` に年間順位／月間順位切替ボタンと内部の2モードを追加。ただし `RANKING_MONTH_PLACES_ENABLED=false` で **月間ボタンはdisabled**。承認なしにこの値をTRUEにすることを禁止。

### 年間モード（従来機能）
- 年間順位を従来の `ranking_distance_monthly`, `ranking_explore_monthly`, `ranking_nations_monthly` から取得。選択月の増加分を右列に表示（PR #208によるNATIONS非表示は**このブランチには含まない**）。
- 現行の公開名/距離・地域の公開設定、年/月選択、検索、招待、共有操作を維持。

### 月間モード（監査専用、UI未公開）
- DISTANCE は `ranking_distance_month_places`。EXPLORE は `ranking_explore_month_places`。順位と距離/地域数は選択月のものとして描画する。月間値の二重表示を避け、月間増加分の右列は描画しない。
- **NATIONS月間は非公開**：`ranking_nations_month_places` は呼ばず、公開停止案内を表示。
- 年間/月間のキャッシュキーを分離。モード変更時は読み直し、応答逆転ガードを維持。

## 監査ゲート
1. 最優先：月間スイッチが本番OFF・disabledであること。PR #208の既存NATIONS月間公開対策なしに、このブランチを公開できると主張しない。
2. 合成ブラウザでスイッチをテスト時のみ有効化し、年/月・国・日英切替・検索・共有画像・スマホ375px・通信エラー・応答逆転を検証。
3. PR #206候補SQLの匿名/認証済ロール実行・プライバシー公開条件・0件/複数人/同日等を隔離DBで検証。
4. `ranking.html` の既存NATIONS月間値はPR #208で別管理しており、このPRだけでNATIONSの公開経路は閉じない。
5. 適用順は独立した承認が必要。PR #208のDB対策・HTTP確認後にUI配信ゲート、PR #206新RPC適用と月間モードONも別途明示承認。
6. この候補は静的テストのみであり、実HTTP、iPhone、実DBの検証は未実施。

## むせへ
PR #206との差分がUI・テスト・文書のみであること、公開スイッチOFFの維持、NATIONS新RPC非呼出し、年間順位回帰なしを確認。UI本番配信と新RPC適用は承認しない。
