# Rings Now P3 v03 本番適用手順書（審査用・適用未承認）
2026-11-26. むせ報告：14:35の隔離試験1回、5分39秒、SQL・並行更新・HTTP14ケース・後片付け・最終確認成立。独立監査の報告に基づく（本書作成者は実行ログを再取得していない）。GitHub赤表示は自己証明を避ける仕様。再実行しない。
## 対象と固定原本
- Supabase project ref fhwvntpzwyenendhcgbw の public.rings_now_snapshot_candidate_v03() の新規作成だけ。
- main e6463da74fe3204cee822a01fc50e0859b7da806、SQL docs/rings-now-p3-snapshot-v03-REVIEW.sql、Git blob 2130f2fadebdace0f944c5164cd1ee1b429fb7c1。隔離実行HEAD f6dd107b0997c92428f4f53b384dc7ce335652f5。実行直前にも両HEADのSQL blob一致を確認。
- 原本のBEGIN/COMMIT、lock_timeout 2s、statement_timeout 10s、CREATE NOT REPLACE、ACL/RLS検査を保持。SQL本文改変・部分実行・再実行禁止。既存v02・テーブル・データ・権限・UIに追加変更しない。
## 適用前（読み取り専用、別途許可範囲内）
- 対象プロジェクト識別、v03不存在（全同名署名確認）、v02原本・権限維持、public公開スキーマ、runsの6列型、RLSと本人SELECTポリシー、authenticatedの非superuser・非BYPASSRLS・非owner継承、auth.uid/jwt定義、デフォルトACLと実効roleを再照合。異常なら停止。
- BEGIN READ ONLY、statement_timeout 5s、lock_timeout 1s、ROLLBACK。対象SQLのSELECT相当をEXPLAINのみ（ANALYZEなし、本人の実データを取得しない）。期間絞り込みのアクセス経路を確認し、懸念があれば停止。索引追加は本手順に含めない。
- main上の公開入口OFF・提供開始時刻nullを確認。一時ページはv02のまま。v03作成時点でauthenticatedから直接呼べることを承認時に明示（UI OFFはRPCを閉じない）。
## 適用（本人が対象原本を明示承認した後のみ）
- 監査合格・上記前提成立・本人の別承認を記録後、Supabase migrationとして原本を1回だけ適用（migration名 rings_now_snapshot_candidate_v03）。失敗・応答不明時は再試行せず、読み取り専用の状態確認と監査へ。
- 適用後、別途許可されたメタデータ照合で本体一致、VOLATILE、SECURITY INVOKER、空search_path、jsonb、実効ACL（authenticatedのみ一般利用可）、RLS/6列/v02不変を確認。公開HTTP確認は別途承認。匿名拒否・キャッシュ・本人認証の確認を分離し、期限切れ本番未実施なら明記。
- 問題時はUI OFFのまま停止。別承認のもと対象v03のみ authenticated EXECUTEをREVOKE、または依存確認後にDROP FUNCTION ... RESTRICT（CASCADE禁止）。v02削除はこの承認に含めない。
## iPhone確認と公開
- 適用とメタデータ監査後、一時ページのv03への切替を別PRで監査・承認。既存セッション、POST/GET/HEAD、no-store、秘密/行値の非表示・非保存を維持。件数が1〜1000、本人のみ、6キー、期間内を要約で確認する。空・blockedなら未成立。キャッシュ旧版を避ける版識別を使用。
- 一時ページ削除とv02停止/撤去は別承認。正式公開・提供開始時刻設定はさらに別判断。既存機能不変、追加費用0円方針。新しいゲート番号なし。
## 本書の状態
手順書のみ。本番接続、EXPLAIN、SQL適用、HTTP、UI変更、試験再実行、マージは行っていない。独立監査と本人承認待ち。
