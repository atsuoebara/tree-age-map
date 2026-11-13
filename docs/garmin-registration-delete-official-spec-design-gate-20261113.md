# Garmin登録解除API：公式仕様・再連携競合・本番適用前ゲート
調査日：2026-11-13（JST）／状態：**設計レビューのみ、実装・本番適用不可**

## 公式資料
1. Garmin Connect Developer Program「OAuth2.0 PKCE Specification」（新旧公開版）
   - https://developerportal.garmin.com/sites/default/files/OAuth2PKCE_1.pdf
   - https://developerportal.garmin.com/sites/default/files/OAuth2PKCE.pdf
2. Garmin Connect Developer Program Overview
   - https://developer.garmin.com/gc-developer-program/overview/
3. Garmin Connect Developer Portal Starter
   - https://developerportal.garmin.com/developer-programs/connect-developer-api

### 公式資料で確認できた事実
- Garmin Connect Developer OAuth2 PKCEの本人同意でアクセストークンが生成される。
- パートナーのアプリに「Disconnect」またはアカウント削除の導線がある場合は、Garmin側の `DELETE https://apis.garmin.com/wellness-api/rest/user/registration` を呼ぶ旨が明記されている。
- `GET /user/id` のGarmin API User IDは同一GarminユーザーがOAuthをやり直しても同じ値に維持される。したがってGarmin User ID単独では新旧の連携を分離できない。
- `GET /user/permissions` で連携時点の権限を取得でき、変更通知もある。
- Starter BusinessはPushベースのAPI提供。これを根拠なくPing/Pullに置き換えない。

### 公開資料だけでは未確認（Garminに照会する必要がある）
- 旧アクセストークンによる `DELETE /user/registration` が、OAuth再同意後の新アクセストークン・新しい登録に与える作用範囲（旧トークン限りか、同一ユーザー×アプリ全体か）。
- 古いリクエストが送信済み・タイムアウトした際のサーバ側確定状況、レスポンス遅延時の新しい同意との順序。
- 再連携後の旧トークン失効と `404/410`、`401/403` の保証された意味、再試行許容条件。
- 第三者の本番環境で試してよいか、sandboxで再現可能か。書面回答を得るまでは推測でNo-Go。

## 現行コードと競合
- `supabase/functions/garmin-oauth/index.ts` は `/disconnect` 冒頭でユーザーIDだけに絞った `import_enabled=false` PATCHを実行し、その後 `garmin_worker_lease`、旧世代の認証情報でGarmin登録削除を呼ぶ。最後のDB DELETEだけ世代で絞る。
- OAuth `/callback` は `garmin_api_connections` を新しい `connection_version` でupsertするが、解除側のworker leaseを獲得しない。
- `garmin-activity-push` のreconcile/drainも遠隔DELETEを実行し、worker leaseはOAuth callback全体を排他しない。
- 既存の隔離CIでは「新しいDB行は残るが、旧世代の遠隔DELETEが再連携成立後に完了できる」を再現済み。**ローカルDBの世代フェンスとGarmin側の登録保護は別物**。
- 旧世代への条件付きPATCH候補（`scripts/garmin-disconnect-fence-candidate.mjs`）だけではこの後半の競合を解消しない。

## 安全な設計の候補（未採用・実装不可）
1. **所有者単位の接続ライフサイクル直列化**：OAuth callbackの新世代接続確定と、接続解除側/worker側の遠隔DELETE開始から確定まで、同じユーザーのライフサイクル遷移を明示的に管理する。これまでの `garmin_worker_lease` だけでは不足。別ユーザーを無駄にブロックしない。
2. **状態の明示**：`connected` → `disconnect_requested` → `remote_revoke_inflight` → `remote_revoke_confirmed` → `disconnected` のような状態、世代UUID、本人同意時点を検証可能にする。**新規同意後に古い解除が再実行されない**よう、旧世代と新世代の条件付き遷移を一元化する。
3. **新連携の公開ゲート**：旧リクエストがremote-inflightの間は、OAuth callbackを新世代の有効接続として確定させない。providerのDELETE確定/未確定後の扱い（再認可を案内すべきか）を公式回答から決める。単純に通信待ちしても、プロバイダー側でタイムアウト後に処理が進む可能性は消えない。
4. **fail closed / 安全な再試行**：不明な遠隔結果を成功と誤記録しない。ローカル取込みを停止し、旧世代の再試行と新連携の承認を矛盾なく扱う。回復にGarmin APIへ無制限の要求を出さず、無料枠の上限を守る。
5. **DB上の更新・削除フェンス**：全ての `import_enabled`変更、トークン更新、最後の行削除を `user_id + connection_version` 条件付きにし、`0行更新`は「他世代が勝った」として終了。ただしこれはlocal rowだけの保護。
6. **既存機能の不変条件**：既存年輪run保存、inbox/ACK、同意なし取得禁止、ユーザーが接続解除しても既存ランは維持、プライバシー・ログ、コスト増ゼロ。外部通信とDBの「原子的な一括ROLLBACK」は不可能なので別管理。

### 設計レビューを通すための追加テスト
- callback→disconnect / disconnect→callback / remote-inflight→callback / remote-timeout→再連携 / refresh-token変更との多順序試験。
- worker drain、手動解除、OAuth callbackの3経路が同一世代ルールで協調すること。
- 別所有者の同時接続、lease期限切れ、失効イベント遅延、同期失敗での状態再確認と安全な再試行。
- 実ロールと本番スキーマを模した隔離PostgreSQL 16試験、既存OAuth mockの仕様追随、および既存ラン・受信ACK非退行。
- Garminからの書面回答がない場合は本番への切替を許可しない。回答を得てもむせ独立監査とオーナー明示承認が必要。

## Garminサポートへの照会文（ドラフト／未送信）
Subject: OAuth2 PKCE registration DELETE behavior during a concurrent reauthorization

We are an approved Garmin Connect Developer Program integration using OAuth2 PKCE and the Activity API. Our application provides a disconnect action that calls DELETE /wellness-api/rest/user/registration using the existing user's access token.

Could you confirm whether a DELETE request authenticated with an older access token can invalidate or deregister a newer OAuth consent / token for the same Garmin account and client ID, if the user completes reauthorization while the DELETE request is in flight?

We would also appreciate clarification on the guaranteed meanings of 204, 401, 403, 404, and 410 for this endpoint, especially when a prior DELETE timed out, and whether a developer sandbox supports testing this race. We will not send any real user tokens or personal data in this inquiry.

Thank you for helping us implement a consent-safe disconnect flow.

## 判定
**公式仕様の公開範囲確認：完了／遠隔登録解除の安全性：未証明（No-Go）**。PR #67 Draft、#68 HOLD。本人の明示承認なしにGarminへの問い合わせを送信せず、実データテストや本番DB/Edge/OAuth変更をしない。
