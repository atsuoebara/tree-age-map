# Garmin registration DELETE送信中の再連携：安全境界（2026-11-13）

状態：**独立監査待ち／本番未変更／外部プロバイダー動作は未証明**

## 対象
- 現行の `supabase/functions/garmin-oauth/index.ts`、隔離で生成する世代フェンス候補。
- `tests/garmin-disconnect-midflight-reconnect.test.mjs` は実ソースの解除処理を実行、HTTP mockのGarmin `DELETE /user/registration` を未完了のまま中断し、合成DB接続世代を新しい値に変更してから204を返す。
- 実Garmin、Supabase、ユーザーデータ、秘密情報への通信なし。

## 観測結果
現行実装・候補の双方で、停止が先に成功した後に通信中の再連携が割り込むと、最終PostgREST DELETEは旧世代フィルタにより新世代のDBレコードを消さない。この範囲はPASS。

一方、**GarminへのDELETEは実際に1回送信され、再連携後に204が返る**。OAuth新連携完了に伴うプロバイダー側状態にこの古いDELETEがどこまで効くかは、そのAPIの実契約・識別子・アクセストークンの世代意味論を確認できていない。合成HTTPではそこを証明できない。

## 本番適用を許可しない理由
- ローカル`connection_version`は自社DBの行削除・更新に対するフェンスであり、Garminの遠隔登録解除エンドポイントにはその世代番号を渡していない。
- `garmin_worker_lease`はOAuth callbackでの再連携保存と原子的に排他する仕組みではない。ローカル行のフェンス成功≠外部認可の安全。
- 切断開始後の再連携が「新しい本人同意」なら、古い遠隔DELETEで新しい本人同意を取り消してはいけない。一方、既に送信中のHTTP DELETEはDB側から取消できない。
- 今後の最小解候補は、provider登録解除の作用範囲を公式に確認し、同意・世代・remote DELETE開始/応答・callback上書きのトランザクション境界を設計すること。単なるPATCH修正のみのマージは不十分。
- ログ・確認画面には詳細トークン・ユーザー識別子・URLクエリを露出しない。事前監査と本人明示承認までAPI実測をしない。

## CI
GitHub Actions `43342592137`、Garmin sample shape probe (isolated) **success**。新規 midflight テスト success。独立監査・プロバイダーの契約確認は残件。

## Gate
**本番Go/No-Go：No-Go**。#67 Draft、#68 HOLD、本番DB/Edge/OAuth/年輪への書込なし。次工程はGarmin registration DELETEのプロバイダー契約確認と、callback同時実行を含む安全な状態遷移の設計監査。
