# Rings Now — 単一SQL文スナップショット案（実DB未検証）

## 目的と現時点の判断
実利用に進むための**具体的な取得候補**をGitHubの文書として置く。SQLファイルは `docs/rings-now-single-statement-snapshot-CANDIDATE.sql` に隔離し、実DBへ適用しない。今回の成果は設計候補のみ。実Auth・実データ・実HTTPは未使用。

既存の `docs/runs-rls-owner-crud-safe-validation-20261106.md` に、`public.runs` の本人限定SELECT RLSが**別目的で**検証された記録がある。ただしその記録は Rings Now 専用RPCの実行権限、JWT、結果の鮮度やスナップショット整合性の実証ではない。

## 提案の要点
- `public.runs` に対する一つのSQL文を候補にする。PostgreSQLの文レベルMVCC読取一貫性を前提に、分割したOFFSET取得や2回走査の間で別時点の集合を混ぜない。
- `auth.uid()` による本人限定、`deleted_at IS NULL`、`ORDER BY id ASC`。返却するJSONに `id,user_id,activity_date,distance_km,started_at,deleted_at` の6列だけ含め、GPS・route・心拍・FITを返さない。
- 1,001件までを最大取得候補にし、**1,001件なら `too_many_rows` の遮断応答で一切の部分ランを返さない**。ゼロ件は空配列。
- `SECURITY INVOKER` により呼出者のDB権限/RLSを使う想定。`SECURITY DEFINER` やservice roleを意図的に避ける。ただし実JWT・権限・RLSを別途確認しない限り採用しない。
- レスポンスのstatus `candidate_snapshot` は**設計候補の結果**で、Rings Nowの解析や本番利用の許可ではない。`ownerScoped` 等の自己申告で実証を代替しない。
- 取得後のアカウント切替・同一ユーザー再ログインは別の認証世代ゲートで必ず失効させる。

## 確認済み／未確認を区別
| 項目 | 状態 |
|---|---|
| 既存リポジトリの`public.runs`とRLSの監査記録 | 存在を確認 |
| SQL案の作成・構文の静的検査 | SQL案作成、実DBでの構文/型検証は未実施 |
| `id/user_id/activity_date/distance_km/started_at/deleted_at`の現行実型 | 未確認 |
| `auth.uid()` の実JWTによる本人限定結果 | 未確認 |
| 実効RLS・GRANT・anon/service_role遮断 | 未確認 |
| 同時更新・削除・ABA・1000/1001件境界の実DB検証 | 未実施 |
| `user_id,id` 索引と速度・タイムアウト | 未確認 |
| Supabaseの実契約・料金・追加費用0円 | 未確認 |
| 既存の公開index・SW・カレンダーと結線 | 禁止・未実施 |

## 将来の実DB検証が別途承認された場合の受入条件
G1〜G8（`docs/rings-now-real-snapshot-preflight-v01.md`）に加え、**G9：追加費用0円と実契約・性能の証拠**を要求する。クエリを適用する前に、実型、RLS、EXECUTE権限、索引、実契約、セキュリティ設定を読み取り専用で確認すること。その確認自体も今回の承認範囲外。

実DBでの候補検証は無認証、他人アカウント、本人、削除済み行、1000/1001件、同時追加/削除、A→logout→A、8日失効、キャッシュ無効と別の証拠を必要とする。実際の実行・移行・本番ONには都度本人承認とむせ独立監査が必要。

## 本番に対する不変条件
`index.html` の入口はOFF、開始時刻null、`sw.js`不変更。PR #109 はHOLD継続。ランの停止は勝手に除外せず、注意書きは確定文「信号待ちやトイレ休憩、自動ポーズなどの影響により、正しく分析できない場合があります。」を使用する。正式名称は**Rings Now**。
