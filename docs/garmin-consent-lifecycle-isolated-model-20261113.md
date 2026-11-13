# Garmin旧登録解除・再同意ライフサイクル：隔離状態モデル（2026-11-13）

**Draft PR #67／production未実装／むせ独立監査待ち／Garminへの照会は未送信**

## 進捗と監査コメント
2026-11-13時点でPR #67の全29件のmerged conversation commentを確認。新しいむせの独立監査報告は当該コメント中に確認できず、直近は実装担当による監査依頼。**「むせ監査合格」と誤認しない**。

Garmin公式公開文書はremote registration DELETEの利用を要求するが、古いBearer TokenでのDELETEが新しいOAuth同意に与える影響は未証明。前工程の`docs/garmin-registration-delete-official-spec-design-gate-20261113.md`のNo-Goを維持。

## 追加した純粋な隔離実装
- `src/garmin-consent-lifecycle-contract.mjs`：副作用がない遷移関数。所有者と接続世代を検査、`connected` → `disconnect_requested` → `revoke_inflight` → `revoke_unknown`（通信結果不明時）→ `disconnected`をモデル化。
- `tests/garmin-consent-lifecycle-contract.test.mjs`：旧世代/他owner拒否、remote DELETE中の再連携要求を保留すること、timeout後のimport停止、unknown時の再試行、後からのconfirmed、再連携時の本人明示の新しいgrantを確認。
- `.github/workflows/garmin-sample-shape-probe.yml`：既存probe CIに新しい状態遷移チェックを追加。

### モデル上の重要な選択
1. 古いremote DELETEが送信中または結果不明なら、新しいOAuth同意を直ちに`connected`として扱わない。pendingGenerationとして保留、canImport=false。
2. remote DELETEの成功が確定しても、保留中の新しい同意を自動で有効化しない。なぜなら古いremote DELETEが新同意も取り消した可能性が残るから。安全な時点で**新規の明示的な再認可**を必要とする。
3. `revoke_unknown`は解除成功とみなさず、取り込み停止を維持。再試行は旧世代に限定。
4. 他ownerの状態は無変更、旧世代イベントはfail closed。

### デザイン上の未解決点
- これは**メモリ上の純粋モデル**で、実Postgres/RLS/複数Edge Function/worker leaseとの原子的排他を証明しない。再起動、期限切れ、同時呼出し、処理中の認可コード失効、workerとcallback、クラッシュ復旧、当人への案内を別途扱うこと。
- Garminによる遠隔登録削除の契約が不明なため、remote in-flight時の新規認可をキューに残すことはUX上は不親切になり得るが、安全優先の模型。実際のOAuthコード/DBテーブルにはまだ適用しない。
- 同一世代に複数のremote DELETEを送らない設計は未完成。「remote retry OK」をGarminのAPI契約未確認のまま本番Goとしない。
- 既存`scripts/test-garmin-oauth.mjs`のmockが現行`garmin_oauth_sessions` POSTに未追随。従来の回帰スイート成功は保証しない。
- 既存年輪・Garmin Push ACKに影響を与える変更は絶対に避ける。追加費用0円、本人の明示承認、独立監査を前提。

## CIエビデンス
GitHub Actions `43346125145`、`Garmin sample shape probe (isolated)` **completed / success**。新規 `Verify Garmin consent and remote revoke lifecycle model` はsuccess、既存隔離probe/remote retry/midflight試験もsuccess。

## 判定
**隔離状態模型：合格／本番導入：No-Go**。Garmin APIについて照会回答を待ち、次に本番スキーマに近いトランザクション/競合模型と旧OAuthテスト修復を独立監査してから実装可否を判断する。本番変更なし。#67 Draft、#68 HOLD。
