# #205 + #208 統合画面候補（2026-11-17）
状態: **合成テスト/むせ独立監査前・本番OFF固定・本番未適用**

## スタック関係
- 統合ブランチ: `feature/ranking-month-mode-privacy-integration-205`、ベースはPR #211 `feature/ranking-month-mode-ui-205`。PR #211 はPR #206のSQL候補の上に積まれた状態。
- PR #208は別ブランチ。**今回のブランチにはPR #208のSQL候補を持ち込まない**。PR #208の保護は `ranking.html` 内のNATIONS表示/キャッシュ処理にのみ移植。DB側は依然現行RPCが月間値を返す。
- mainへのマージやSupabase SQL適用は行わない。PR #208→PR #206→PR #211→本統合PRという番号順の単純連続マージを保証するものではない。各PRの依存、実際のbase/HEAD及び衝突を照合して別途マージ方針を決める。

## 統合内容
1. NATIONS年間表示の `month_km` セルは作らない。新旧キャッシュ・RPC応答は `month_km:null` でサニタイズし、旧NATIONSキーをページ初期化時に削除。
2. DISTANCE/EXPLORE は年間モードで従来RPC。月間モードではPR #206の新RPCを選ぶコードを保持。ただし `RANKING_MONTH_PLACES_ENABLED=false`、HTML disabled・JS disabled・クリックガードで公開OFF。
3. NATIONSの月間順位RPCは一切呼び出さず、月間モードのNATIONSパネルはプライバシー保留案内。年間NATIONSの距離と参加人数は今までどおりの公開方針なので、少人数・時系列差分の推測リスクは残る。
4. 年間/月間のDISTANCE・EXPLOREキャッシュは分離し、応答競合の防御を維持。

## 証明できない事項とリリース条件
- この候補を本番に出しても **既存`ranking_nations_monthly`の旧公開APIは閉じない**。UIだけ隠しても値は取得可能。DB側のPR #208候補が明示承認を受け、本番に先行適用され、匿名/認証済み実HTTPで `month_km:null` を確認できるまで**画面公開は禁止**。
- PR #208の非公開バックアップ・旧SQL再適用防止運用も別途解消が必要。
- PR #206のDISTANCE/EXPLORE月間RPCの隔離実行検証・実Supabase適用は別工程。月間モードをONにするにはさらにAtsuoの明示承認が必要。
- 静的チェックは表示・データ保護の構文契約に限る。実ブラウザ375px/iPhone、年月/国/言語切替、検索、共有画像、キャッシュ、応答競合、ゼロ件、実HTTPはまだ未確認。統合後のむせ独立監査必須。
- 既存 `ranking-monthly.sql` の再適用でNATIONSの月間距離が復活するため、fail-closed復旧順序と再適用対策はPR #208ランブックに従う。
- このブランチからmainへ直接マージしない。各変更の承認・マージ順序・競合解消は監査後に確定する。

## むせ監査依頼
1. PR #211に対する差分が `ranking.html`＋テスト＋文書のみか、PR #208の守るべき動作が統合後も残っているか。
2. NATIONS月間値の表示セル・ローカルキャッシュ・API応答マスク・旧キャッシュ破棄、NATIONS月間新RPC非呼出し。
3. 年間モードのDISTANCE/EXPLORE/NATIONSのRPCとUI公開制御、月間スイッチのハードOFF、モード別キャッシュ・応答ガード。
4. スマホ375px・言語・検索・年月・共有画像・応答競合・エラーでの合成ブラウザテスト。テスト不足は観察として残す。
5. DB/本番UI/mainの変更は未承認。安全にマージ可能かは判断せず、候補統合としてのみ合否をつける。
