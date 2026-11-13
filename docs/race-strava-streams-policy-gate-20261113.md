# Strava activity streams の利用可能性と分析の規約ゲート（2026-11-13）

**PR #67 Draft、実ユーザーデータゼロ、API通信ゼロ、本番No-Go**

## 公式確認（2026-11-13）
- Strava API Reference: https://developers.strava.com/docs/reference/ — `GET /activities/{id}/streams` は該当アクティビティのストリームを返す。通常は`activity:read`、Only Meアクティビティには`activity:read_all`が必要。求めたstreamが全て返るとは保証しない。
- Strava API Policy（2026-06-01発効）：https://www.strava.com/legal/api_policy
  - §2.1 本人認証とデータ種別・収集手段・同意撤回・削除の通知、§2.3本人以外にStravaデータを表示しない。
  - **§5.4 集計・analytics/analyses・他顧客データとの組合せを制限し、派生出力にも適用**。本人が望む1km分析であっても、この規約で許されると断定しない。追加の法務/Strava開発者側確認が必要。
  - §6.2 キャッシュは最大7日、§6.3 Strava上で削除されたデータの反映は48時間以内、§6.4 用途に必要な範囲のみ保持。個人のプライバシーおよび年輪の既存保存との整合に特に注意。
  - §7.2 データ取得種類の変更には通知と同意を要求。
- Strava API Agreement: https://www.strava.com/legal/api — Stravaサービスと競合/模倣しないことが条件であり、ランリングの詳細分析UIの許容範囲もレビュー対象。
- 2026-09-18の公式ヘルプ：https://support.strava.com/en-us/articles/15401608-api-agreement-update-how-data-appears-on-3rd-party-apps

## 今回の隔離検証
`src/race-strava-stream-gate.mjs` は合成したStrava風のJSONの**形状と必要権限の検査のみ**。distance、timeがなくては1km区間の候補にできない。heartrate、cadence、wattsは任意のため欠損を明示。ストリーム長の相違、単調ではないtime・distance、不正数値、本人の認証/同意なし、Only Me活動にread_allがない場合は拒否。品質チェックは最終品質証明ではない。time/distanceがそろっていても実分析の権限を生まない。

`analysisAllowed`、`fetchAllowed`、`storageAllowed`は**常にfalse**。テストフラグ `policyApproval=true` を渡しても解除できない。ストリーム取得の実装・1km集計計算・実データ保存・Garmin/COROSのデータとの合成処理はいずれも未接続。

## 追加の安全ゲート
1. Strava側へ、本人限定の「1km区間経過時間と心拍等の平均表示」が§5.4の制限と両立するか、**書面で確認**すること。既存Strava APIで走行経路を扱うランリング全体への影響も別途監査。
2. データを分析・保持する際の規約（7日キャッシュ等）とアカウント連携解除/削除フローの整合確認。Strava由来データとGarmin/COROSの詳細を統合する場合の禁止事項についても回答を得る。
3. Stravaの許可済みscopeとactivity streams利用可否を、本人の明示同意とAPIアクセス可否の範囲で別途検証。保存先、保持期間、削除を設計。
4. 既存保存済みrunを勝手に変更・重複保存しない。Garmin公式API解除問題は別ゲート。むせ独立監査・オーナー最終承認を要する。

**判定**：取得APIの存在・必要scopeは公式確認済み。**1km分析の利用許可は未確認（No-Go）**。PR #67 Draft、#68 HOLD。本番のStrava/Garmin/COROS/Connect IQ/runs/年輪に変更なし。
