# Garmin remote DELETE結果不明（revoke_unknown）の安全復旧案
2026-11-13 / PR #67 Draft / **設計・架空入力テストだけ。production No-Go**

## 優先原則
ユーザーが「解除」を選んだら、アプリ内取り込みは即停止。外部Garminの登録DELETEが送信済みか・成立したか判らない状態を、成功や失敗に読み替えない。送信済みリクエストの取り消しはできない可能性がある。旧世代の再送は新しい本人同意を消す恐れがあり、Garmin書面回答前は行わない。新しいOAuth callback/保留済み認証情報を自動で再有効化しない。

## 提案する復旧手順（**未実装**）
1. `revoke_unknown` になったowner/generation/attemptの監査情報を、トークン・GPS・Garmin userIdを含めず最小限で確保。実DBの権限、データ保持、監査アクセスは別途承認。
2. worker/手動解除/OAuth callbackは、そのownerで旧世代のremote DELETEを自動リトライせず、新しい連携の公開・取り込みも禁止。別ownerは止めない。
3. 画面では「Garminの接続解除を確認中です。ランの取り込みは停止しています。確認が必要なため、再連携はまだ利用できません。」などと表示。接続済み/解除完了と誤表示しない。スマホ優先。
4. Garmin公式の書面回答で、旧アクセストークンDELETEの作用範囲とタイムアウト後の安全な判定/処理を確認。`204/401/403/404/410`を推測で「登録解除済み」判定しない。
5. 公式に認められた手段で遠隔解除結果を検証できたことを確認。個人情報・アクセストークンをログに載せず、実API操作には改めて明示承認を得る。
6. むせがowner/generation/attemptの世代一致、実DBロール、復旧手段、本人同意、年輪/Push ACKへの非干渉を独立監査。
7. 本人へ**新たなOAuth認可操作**を案内する復旧案を検討。古い一回限り認可コード、保留中トークンを勝手に再利用しない。確認が全部揃っても自動で再連携に戻さない。実装には明示承認・新しい隔離/本番ロールテストが必要。

## 隔離判定契約
- `src/garmin-unknown-revoke-recovery-gate.mjs` は読み取り専用の純粋関数。書込・HTTP通信・UIは行わない。
- `tests/garmin-unknown-revoke-recovery-gate.test.mjs` は状態違い、evidence欠損、世代すれ違い、Garmin範囲未確認、遠隔結果未確認、独立監査待ち、全証拠ありの7ケースを確認。
- 全7ケースで `retryRemoteDelete=false`、`activatePendingConsent=false`、`importEnabled=false`、`requiresFreshUserAuthorization=true` とする。「全証拠あり」も `fresh_authorization_review` であり復旧実行許可ではない。
- `garmin_consent_lease_recovery_setup.sql` の未知状態自動再claim禁止と、`src/garmin-lifecycle-integration-plan.mjs`の `claim_remote_revoke.expected='disconnect_requested'` に整合する。

## 未解決／No-Go
- Garmin遠隔 `DELETE /user/registration` の新同意への影響・タイムアウトの後続結果は公式回答がない。
- 実装中の手動解除/Push worker/OAuth callbackはまだowner単位の共有原子的遷移へ未統一。今回の**純粋関数テストでは本番安全は証明しない**。
- `revoke_unknown`からの永続DB状態解消RPC、現実の回復UI/本人確認/申請ルート、同意保留tokenの安全な破棄、障害発生時の運用者連絡、処理費用0円の運用は要設計・実ロール試験。
- 何も確認できない場合は「取込停止・再送なし・新連携無効」を継続し、復旧完了と呼ばない。
- PR #67 Draft／PR #68 HOLD、マージ/デプロイ/実データ照会/外部Garmin呼び出しなし。
