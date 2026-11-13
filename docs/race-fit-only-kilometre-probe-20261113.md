# 本人提供FITのみ：1km区間経過時間の合成標本PoC

- 日付：2026-11-13
- 対象：Draft PR #67
- **判定：隔離テスト成功／実FITの読取・実データ保存・本番解析・規約適合は未証明・No-Go**

## 作業内容

- `src/race-fit-only-split-probe.mjs`：既存の`assessOwnFitForOfflineReview`の結果を入口ゲートとして使う副作用のないPoC。
- `tests/race-fit-only-split-probe.test.mjs`：合成された、FITレコードを正規化したような`{elapsedS,distanceM}`時系列に対し、1,000m境界の**時計上の経過時間**を線形補間して区間化。
- `.github/workflows/garmin-sample-shape-probe.yml`に専用ステップ追加。

## 検証
1. 2kmの合成値で1km目300秒、2km目300秒。端数100mを追加した場合は最後に30秒の`partial:true`区間を付加。
2. 距離が増えない60秒を追加するとその時間も含め1km目360秒、2km目300秒。停滞の原因が自動停止かGPS問題かは断定せず`distance_plateau_elapsed_kept`、`plateau_cause_unknown`で示す。
3. 計測点間の距離差250m超／経過時間差120秒超は、設計上の参考しきい値として`unverified_sample_gap`を付ける。この値の根拠・感度検証は未完了で、しきい値以下なら品質保証とは**言わない**。
4. 走行種別、本人提供、private view、原点（距離0m・経過時間0秒）、時系列単調増加、単位・入力個数を検査。Strava streamsやGarmin直接APIの出所は拒否。
5. センサー平均値は計算しない。元配列を変更しない。出力は`synthetic_candidate_only`、`qualityCertified:false`、`analysisAllowed:false`、`writeAllowed:false`、`providerDataCombined:false`。

## CI証拠

GitHub Actions #43354445576、`Verify synthetic FIT-only kilometre clock elapsed candidates` **success**、ジョブ全体もsuccess。

## 制限・残課題

- **実FITバイナリの読み込みなし**。現行`fit_importer.js`のparserと新PoCは未接続。FITのtimer pause・developer fields・標本の不整合・時刻変換を検証していない。
- 計測開始と距離開始がともに0の正規化レコードを要求。実際の端末は先頭・末尾のレコードがずれる可能性があり、ゼロ原点の推定・補完を勝手に実施しない。
- 区間境界の線形補間は算術的な候補値で、実際のGPS断絶や停止中のデータ品質を認定しない。公式大会のラップと同一視しない。
- FITファイルの所有・同意・プライバシー・端末内処理/保存・既存runへの関連付け、Stravaとの照合、無料枠、規約、独立監査は未解決。
- Strava公式回答はTicket #19691 の自動返信までで分析可否の回答なし。GarminのDELETE再同意の回答も別件で未確認。
- 本番のStrava、COROS、Garmin API、Connect IQ、runs、年輪、Supabase/Edge/DBは変更0。PR #67 Draft、PR #68 HOLD。マージ・デプロイなし。

## 次の独立監査

むせに、1km境界補間・停滞時の経過時間保持・ゼロ原点・端数区間・gapの未検証しきい値・実FITを扱ったと誤認させない表現・Strava混在拒否・本番非変更を確認してもらう。最終的なGo/No-GoはAtsuoの明示承認を必要とする。
