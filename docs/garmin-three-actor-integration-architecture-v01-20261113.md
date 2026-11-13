# Garmin OAuth同意・登録解除を3経路で統一する設計 v0.1

2026-11-13 / Draft PR #67 / **本番No-Go／設計・隔離テストのみ**

## 背景・検証済み現状

- 手動 `supabase/functions/garmin-oauth/index.ts` の `/disconnect` は、`garmin_api_connections?user_id=eq.<owner>` の無世代PATCHで `import_enabled=false` としてから `garmin_worker_lease` に入る。旧世代から新世代の取り込みを止める競合が存在。
- `/callback` は新世代UUIDの `garmin_api_connections` upsertを実行するが、解除リクエストと**所有者単位のロックを共有していない**。
- `supabase/functions/garmin-activity-push/index.ts` の `drain/reconcile` は `garmin_worker_lease` でworker排他し、`import_enabled=false` でGarminの `DELETE /user/registration` を実行する。接続行の最終DELETEは `user_id + connection_version` でフェンスしている。しかしOAuth callbackとの外部通信排他がなく、旧remote DELETEが新しいGarminの同意にどう作用するか未確認。
- 修復した `scripts/test-garmin-oauth.mjs` はGitHub Actions #43347525905でPASS。むせの以前の判定は隔離検証の**条件付き合格**、本番No-Go。修復分の独立再監査は未確認。
- 既存のrun、inbox、ACK、Strava及び年輪データは新しい状態管理の実装によって壊さない。接続解除で既存ランを削除しない。

## 機械的に検査する対象

`src/garmin-lifecycle-integration-plan.mjs` は**設計契約であり本番の実装ではない**。`tests/garmin-lifecycle-integration-plan.test.mjs` は下記の禁止条件・3者の責任境界を点検する。

| 経路 | 共有すべきローカル操作 | 外部操作 |
| --- | --- | --- |
| /disconnect | ①owner+generationを選択し、②同世代だけ取込停止・解除要求、③解除をclaim、④終了/unknownを記録 | claimした旧世代トークンだけで登録解除 |
| /callback | ①認可コード交換・Garmin ID確認後、新世代の同意を**保留 or 公開可能**と判定し、②DB上の1操作で世代を確定 | ID・permissions取得。ただし旧remote DELETEの結果が不明なら新接続を公開しない |
| Push worker | ①旧世代解除を排他claim、②結果確定/不明をowner+generation+leaseで書き込み、③新世代を触らない | 旧接続に限り `/registration DELETE`。不明時の無制限再試行は禁止 |

## 提案状態と信頼境界

- `connected` → `disconnect_requested` → `revoke_inflight` → `disconnected`。
- `revoke_inflight` 中にタイムアウト・プロセス障害なら `revoke_unknown`。**この状態では、旧遠隔要求がサーバ側で成立したか不明**。自動で `connected` に戻さない。
- 新しい認可は解除中なら `pending_generation` として保持し、`can_import=false`。remote DELETEが確定してもpendingを自動有効にせず、本人へ安全な再認可を案内する（現段階の安全側方針）。
- Garmin `userId` は再認可後も同一のため、Garmin IDのみの排他を保証とはみなさない。
- ローカル `connection_version` は本人・接続世代の識別子。DBでの誤停止・誤削除を防ぐが、Garminの登録削除APIへ渡されないため**遠隔同意を保護する証拠にはならない**。

## トランザクション境界の提案（未実装）

1. **同意管理テーブルの候補**：`owner_id uuid PRIMARY KEY`、`active_generation uuid`、`phase`、`pending_generation uuid NULL`、`can_import boolean`、`lease_token uuid NULL`、`lease_expires_at timestamptz NULL`、`attempt_id uuid NULL`、`updated_at`。トークン本体は現在の暗号化接続領域から不用意に複製しない。実DBへ新テーブル/列を追加する決定は保留。
2. **DB内で短く完結する原子的操作**：owner行 `SELECT ... FOR UPDATE` のもとで、古い世代の取込停止と要求登録、旧世代claim、callbackの新世代登録/保留、結果の条件付き確定を行う。RPCには所有者ロール確認、`SECURITY INVOKER`または監査済み権限制御、明示的`search_path`、generationとleaseのCAS条件が必要。
3. **外部呼出しはDBトランザクション外**：claimが永続化された後でのみGarmin `DELETE /registration` を実行。呼出し完了後に`owner + generation + lease_token + attempt_id`が一致する場合だけ状態確定。違えば古い結果として拒否。
4. **callbackが外部呼出しをまたいで上書きしない**：`revoke_inflight`/ `revoke_unknown` では新認証の公開を拒否または保留。先にcallbackがconnectedを確定したら、古い世代の手動・worker操作は失効して開始不可。**既に送信された外部DELETEは取消不能**であり、後からの同意が有効か保証するにはGarminの回答が必要。
5. **クラッシュ・lease期限切れ**：DB lease切れとGarmin HTTPタイムアウトは同じではない。外部処理結果が不明なら `revoke_unknown` を保持。無期限ロックや自動接続再開は禁止。本人への表示は `disconnected` と `unknown` を混同しない。復旧方法はprovider回答後に決定。
6. **本人の意思とUI**：古い解除が無効になったときに `?garmin=disconnected` を無条件で返さない。新しい同意が保留中なら接続済みと表示しない。未確定時は「接続の確認中・取り込み停止」のような事実に合う表現を使う（UI実装は保留）。
7. **費用0円**：新たな外部サービス/有料キューを導入しないこと。バックオフや既存workerとの統合は、cron枠・Supabase制限・無料枠を別途検証する。
8. **ログ・機密**：アクセストークン、refresh token、認証コード、Garmin user ID、認証URL、GPSは監査ログ・CIログ・PRに記録しない。

## 未解決の設計上の矛盾・追加の審査ポイント

- `stage_new_consent` 中の認可コードは一回限り。pendingだけ保存しても、古いremote DELETE確定後にその認可を安全に再利用できるとは限らない。**pending tokenは「後で自動有効化」の許可ではない**。保留時の暗号化・保存禁止・破棄・表示は別仕様が必要。
- remote `DELETE` が送信済みだがHTTPタイムアウトしたとき、失効したleaseの後続workerが無制限にDELETEを再送すると、新しい同意を潰す可能性がある。providerの応答意味論が確認できるまで自動再送を認可しない。
- 複数の `garmin_oauth_sessions` に同じユーザーのstateがある場合、最後の同意が本人の最新意思か、古いcallbackをどう拒否するか、`state`だけでは足りない可能性。セッションの取得・失効のCAS条件が要る。
- 既存 `garmin_worker_lease` が全アカウントを直列化する方式だとしても、新設するowner leaseとその取得順序が逆になるとdeadlockの可能性。最終設計でロック順序と期限を固定する。
- 本番RLS、service-role/Edge Runtime権限、トリガ `garmin_cancel_queue`、`garmin_commit_activity`、Strava/Coros連携、Journal・年輪非退行、Garmin受信ACK再送は分離して監査。
- 既存の`src/garmin-consent-lifecycle-contract.mjs` と`consent_ci` SQLは隔離模型。実ソース・本番ロールの統合を証明したものではない。

## 本番Go/No-Go（全て必要）
- Garmin公式書面で旧tokenの `DELETE` が新同意へ及ぼす作用、タイムアウト、応答コードと安全な再試行を確認。
- 手動解除・OAuth callback・Push workerが同じ所有者単位のCAS・排他に従う本番設計をむせが独立承認。
- DB実スキーマ/RLS/ロール、例外・多重同意・クラッシュ回復・API呼び出し順を隔離テストし、既存OAuth/Push/年輪を維持。
- コスト増0円、ユーザー本人同意、セキュリティ、記録保持/削除を明文化。
- **オーナーの明示承認**前に本番への適用/マージをしない。

**現在の判定**：仕様案 v0.1（独立監査待ち）。**本番No-Go**。PR #67 Draft、#68 HOLD、Garminへの問い合わせは未送信。
