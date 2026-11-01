# B-1 T1–T9 CI確認と監査ブロッカー記録 — 2026-11-01

## 確認できた事実
- 対象GitHubコード: scripts/b1-anonymity-synthetic.test.mjs（1d74332）
- Actions設定: .github/workflows/b1-anonymity-synthetic.yml（9d7c336）
- 監査依頼: docs/b1-anonymity-synthetic-audit-request-20261101.md（dfbca53）
- GitHubコネクタの fetch_commit_workflow_runs(9d7c336) は workflow_runs=[]。このAPIはPR起動のみ返す仕様であり、push実行が存在しない証明にはならない。
- この作業からはGitHub ActionsジョブID/実行ログを取得できず、**CI成功未確認**。実行失敗とも断定しない。
- 追加のローカル実行もGitHubソースを取得できなかったため確認できていない。

## 監査前のコードレビュー上の区別
- T1は人数境界・集中ケースの検査であり匿名性基準を導出しない。
- T2, T3, T5, T6, T9は攻撃が成立する例の実証であって、防御の合格を意味しない。
- T4は国別・参加人数の簡易モデルで、国境の距離配賦ロジックは未検証。
- T7は状態オブジェクトのモック検証。DB競合・撤回の原子性・SQLロックは未試験。
- T8はゲートのモック検証。実HTTP、CDN、サービスワーカー、同時アクセスは未試験。
- CIで全PASSでも製品の公開承認不可。

## 次の独立監査に必要な証拠
1. GitHub Actions > B-1 synthetic anonymity T1-T9 > workflow run のURL、結論、jobログ、対象commit SHAを確認。
2. CIが未起動ならworkflow構文とpush対象パス、デフォルトブランチの実行条件を点検。workflow_dispatchで手動起動も可能。
3. T1〜T9のテスト内容の不足分をレビューし、実匿名性閾値の探索・攻撃成功率・既存公開統計との組合せテストを別工程として追加。
4. PostgreSQLの実同時実行、HTTP no-store、撤回後の旧応答停止は別の統合試験で証明する。

## 保護条件
本番Supabase変更なし、正式同意収集OFF、一般公開OFF。Atsuo最終承認とむせ独立監査なしに公開しない。
