# Garmin 自動受信：本番メタデータだけの読み取り確認（2026-11-12）

## 範囲
- Runner's Rings Supabaseプロジェクトの **information_schema（列メタデータ）と受信箱の状態別集計だけ**を読み取り確認。
- **Garmin実データのraw JSON・位置・心拍・時刻・ユーザーID・接続秘密鍵は一切抽出していない**。
- 書き込み・DB変更・マージ・本番関数変更なし。
- Garmin Push配送のSecret設定ミスはすでに解消済み（オーナー本人確認）。古い問い合わせメールだけを根拠に未復旧扱いしない。

## 本番で確認できたテーブル定義（読み取り）
- `public.garmin_activity_inbox` に `id bigint`、`user_id uuid`、`garmin_user_id text`、`summary_id text`、`payload jsonb`、`state text`、`attempts integer`、`next_retry_at timestamptz`、`last_error text`、`created_at timestamptz`、`updated_at timestamptz`、`connection_version uuid` が存在。
- `public.runs` に `created_at timestamptz`、`user_id uuid`、`source text`、`started_at timestamptz`、`source_external_id text`、`deleted_at timestamptz` が存在。
- `public.garmin_connections` に `user_id uuid`、`created_at timestamptz` が存在。**このメタデータ照合だけでは、トリガー/RLS/関数の権限や保存成功経路の原子性は証明できない**。

## 本番Inboxのstate別件数（2026-11-12の調査時点のスナップショット）
```text
state       total   payload != {}
saved        34       0
duplicate     5       0
ignored       1       0
```
SQL（本文を返さず集計のみ）：
```sql
select state, count(*)::integer as rows_total,
       count(*) filter (where payload <> '{}'::jsonb)::integer as nonempty_payload_rows
from public.garmin_activity_inbox
group by state order by state;
```

## ここまでで言えること／言えないこと
- **本番にGarmin受信を処理した痕跡は存在する**。この時点で最終状態の受信箱40件全件の`payload`は空であり、既存DBに残るrawサンプルを後から検査する経路はない。
- savedが34件は**受信箱の処理件数**であり「ユーザーのランが現在34件ある」とは断定しない。重複や取り消し、別ソースとの関係は集計だけでは不明。
- 実Pushに`samples[].startTimeInSeconds`/`totalDistanceInMeters`/`heartRate`/`heartrate`のどれが入るかは、**上記集計からは何も分からない**。これまでの想定を確定扱いしない。
- 既存受信関数`sanitized()`がサンプルの時刻・距離・心拍を削り、`garmin_commit_activity`成功時にinboxを空にするため、**過去の履歴からの再構成は不可**。
- 「8日間だけ保持」「追加費用0円」「新しいガチランの本人選択のみ」という基本制約は維持。ランを新しく走ってもらう必要は現時点ではない。

## 次の工程のGo/No-Go
1. 後付けで過去のinbox rawを発掘する案は**No-Go**（空）。
2. 次に必要なのは **新規に受信するActivity Detailsのフィールド名・型を匿名集計で検査**する方法の独立設計監査。現行年輪取り込みの成功/失敗を一切左右せず、秘匿情報と実データを恒久保存・標準ログ出力しない構成に限定する。
3. **実データを扱う検証の開始および本番コード・DBの変更は、本人の明示承認とむせの事前監査後**。単に「ネクスト」の指示を本番改修の許可として扱わない。
4. GitHubにあるローカル検査器は安全性の技術検証用で、**本番の既存データに対して実行していない**。これでGarminの項目名が確定したと誤認しない。

結論：**Garmin Pushは復旧済み、本番inboxの詳細rawは残存0件、実受信サンプル構造は未確認。**次は将来の受信時に匿名のフィールド件数だけを見る検証を設計・監査すること。
