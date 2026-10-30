# B-1 サーバー境界・公開配信導入前調査（2026-10-30）
状態：**本番Supabaseのメタデータを読み取りのみで確認。変更・一般公開なし。**

## 確認結果
- `public.region_rings_consent`: `user_id`, `consented`, `updated_at`。既存「参加希望」の保存先。正式同意とは独立。
- `rr_private.region_rings_public_authorization`: `user_id`, `authorized`, `policy_version`, `authorized_at`, `revoked_at`, `updated_at`。正式同意用として想定される隔離保存先（同意受付APIは未実装）。
- `rr_private.region_rings_public_candidate`: `country_code`, `region_code`, `region_name`, `year`, `month`, `participant_count`, `distance_km`, `calculated_at`。非公開の候補保存用。**このテーブルをそのまま一般公開APIで返すのは禁止**。
- `rr_private.region_rings_refresh_state`: `singleton`, `is_dirty`, `last_invalidated_at`, `reason`, `publication_enabled`。既存の失効・緊急停止ゲート。
- SQLメタデータで確認できた関数: `public.get_my_region_rings(...)` は本人専用、`public.get_rings_today(...)` はToday用、`rr_private.invalidate_region_rings_cache()` は失効トリガー。現在の関数一覧から**地域の年輪専用の一般公開RPCは確認されなかった**。
- 既存Edge Function一覧にToday同期 `rings-today-live-sync` がある。Todayの配信方式や母集団は地域年輪とは別管理すべき。今回、既存Edge Functionのコードは変更していない。

## 公開APIの実装前に必要な追加状態
現行の失効状態 `is_dirty` と公開フラグだけでは、公開済みの単一スナップショットに関する「承認済み世代」「年の締め」「撤回したセルの停止状態」「再公開禁止履歴」を安全に表現しきれない。**別の隔離公開台帳・審査ゲート設計が必要**。本番テーブル変更はまだ行わない。

候補のAPI例：`GET /functions/v1/region-rings-public`（仮称、**未デプロイ**）
- HTTPレスポンスは `Cache-Control: no-store, private` を基本とし、成功時も丸めた国×確定年の距離のみ。人数、集計日時、セルの秘匿理由、内部世代などは返さない。
- 毎リクエストDB側で公開フラグ、失効、承認済みスナップショット、規約版・取消、公開世代を確認し、不一致は数値なし。
- `service_role` や非公開スキーマ権限をブラウザには配らず、認可済みサーバーからのみ検査する。
- ただしDBの確認からHTTP配信までの間の撤回レース、既存CDN/プロキシ/ブラウザによるキャッシュは別途隔離負荷・撤回試験で検証する。
- 公開を始めるまではEdge FunctionやURLを本番に公開しない（開発時は隔離環境/ローカルスタブで再現）。

## 確定年との整合・次工程
前案「翌年4月1日00:00 UTC」は未確定。活動日の帰属は既存のDB取り込み・`get_my_region_rings` の日時／国判定と照合が必要。締め後の遅延取込が公開値に黙って反映されないことを合成ケースで検証する。

**次に作るもの**：
1. 本番の既存地域年輪RPC定義・スキーマの読み取り検証（個人データは不要）。
2. 合成データだけで「公開OFF/dirty/世代失効/撤回前後/締め後追い」のサーバー応答を検証する隔離API試験。
3. むせにAPI契約・キャッシュ/撤回レース・同意版チェックを監査依頼。初回公開は別途Atsuo承認。

**現状：本番データ・製品コード・DB設定は変更なし。正式同意受付も一般公開もOFF。**
