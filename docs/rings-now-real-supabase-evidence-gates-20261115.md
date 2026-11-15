# Rings Now — 実Supabase適用前の証拠ゲート v0.1（計画のみ／実行禁止）

作成日：2026-11-15。基点 main `910bfe1e`（PR #156 マージ済）。**状態：HOLD／検証手順の設計のみ。**
この文書・PRの作成、監査、マージは、実Supabaseへの接続・SQL実行・RPC作成・JWT発行・実HTTP試験・実FIT取込・本番ONの承認を意味しない。

## 既に証明された範囲
- PR #155: 隔離 PostgreSQL 17 における候補SQL原文の構文・応答境界と本人分離などの合成試験。
- PR #156: `rings_fixture` が関数を作成するとき、模擬 `anon` / `authenticated` / `service_role` に明示的デフォルト EXECUTE を付けたうえで、作成前の `proacl` に存在することと、候補SQL適用後に PUBLIC / anon / service_role の権限がなくなり authenticated のみ残ることを隔離CIで確認。
- ただし実Supabaseの所有者・初期ACL・role membership・JWT・PostgREST・実RLS・性能・課金・同時更新での結果は**未証明**。合成CI成功を実本番の安全性と取り違えない。

## 段階別の承認境界
- **P0（現時点で許可されること）**: GitHub上の既存資料の閲覧・差分確認、公開ドキュメント調査、検証設計。実Supabaseへのアクセスは行わない。PRはDraftに固定。
- **P1（別途本人の明示承認が必要）**: 実Supabaseでの *読み取り専用* のメタデータ確認（実行主体・関数所有者、`proacl`・初期ACL・ロール継承関係・RLSポリシー・GRANT・実際の型）。SQLを使うかどうかも含め承認対象とし、既存データの行内容・個人識別値・秘密・JWTをレポートへ転載しない。読み取りが運用負荷を増やす場合は中止。
- **P2（さらに別の明示承認＋隔離先と戻し手順が必要）**: ステージング相当で候補SQLの適用・ACL実測・PostgREST/認証クライアントのテスト。対象が本番しかない場合は勝手に代用しない。ロールバック手順、実施前バックアップ、影響、費用を明示して再判断。
- **P3（新たな本人承認が必要）**: 実ラン連携、カレンダー接続、実FIT、公開入口ON。P1/P2通過だけで解禁しない。

## P1 で必要な実測エビデンス（接続・実行はこのPRでは禁止）
| ID | 証拠 | 合格条件 / fail-closed |
|---|---|---|
| R1 | 対象Supabaseプロジェクト・DB識別、接続先・実行ロール、関数の所有者候補 | 意図した対象とロールが一意に確認できない場合は中止 |
| R2 | 既存関数の有無、`pg_proc.proacl` 全項目、デフォルトACL、schema USAGE、権限の継承 | PUBLIC・anon・authenticated・service_role・owner・継承経由の実効権限を分離して記録。想定外の経路は中止 |
| R3 | `public.runs` の対象6列の実型・nullable・RLSと各ポリシー、実行者テーブル権限 | `SECURITY INVOKER` の下で本人限定が成立する見通し。曖昧なら中止 |
| R4 | Auth / PostgREST の露出設定・RPC公開面の設計（現時点では実呼び出し不可） | APIで誰が呼べるか未証明なら実結線禁止 |
| R5 | 費用・影響の事前見積り（利用枠、別環境・ログ・バックアップ・Actions利用枠） | 追加費用が発生する可能性を排除できない操作は行わず本人へ提示 |

**注意**: 候補 `docs/rings-now-single-statement-snapshot-CANDIDATE.sql` は `BEGIN; CREATE OR REPLACE FUNCTION; REVOKE; GRANT; COMMIT;` を含む変更SQL。読み取り専用の確認として流してはならない。SQL全文・関数名の代替も無断で実行しない。

## P2 で必要な試験（未承認・未実施）
- A1 権限：実適用前後の `proacl` 全量、PUBLIC・anon・service_roleの EXECUTE 不可、authenticatedの許可、関数所有者・上位ロール・BYPASSRLS等による迂回経路を確認。実JWT・失効JWT・ユーザー切替・無認証・PostgRESTで実測。
- A2 一貫性：一SQLステートメントのスナップショットという設計と、現実の同時 INSERT / UPDATE / DELETE / ABA / 同件数入替での応答を隔離データで検証。結果が途中状態にならないことを評価し、アプリ側の遅延応答破棄も別途証明。
- A3 境界：本人だけ、他人ゼロ、削除済み除外、必須NULLは全件遮断、0件、1,000件成功、1,001件は全件遮断、too_many_rows優先、返却は指定6列のみ。実ランの内容をログやGitHubへ出さない。
- A4 性能：代表的な行数と並行状況の応答時間、クエリ計画、CPU/IOと利用上限を測定。測定方式・負荷上限・中止条件を先に決定する。
- A5 費用：Supabase利用枠・追加課金・外部監視・CIなどを含め、ユーザー負担がゼロ追加で収まる根拠を確認。根拠がなければ保留。
- A6 復旧：適用失敗・途中切断・権限異常時の停止とロールバック、適用前後の整合性比較、再実行の扱いを確定。

## 本番入口と別経路の固定
- `index.html` の `RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false` と `RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null` を維持。 `sw.js`、公開HTML、既存DB、カレンダー、解析エンジンには手を入れない。
- PR #109 は Draft/HOLD。iPhoneのカレンダーから本人がガチランを選ぶ原則を守り、PC検証を本番導線の前提にしない。
- 8日＝691,200秒は開始時刻基準。停止を含む時計経過、注意書き、同日複数ランの本人選択、実FITの外部送信禁止は引き続き必須。

## むせ独立監査依頼
1. 差分はこの新規文書のみで、SQL候補・ワークフロー・index.html・sw.js・DB関連実行コードの変更なし。
2. P0/P1/P2/P3の承認境界が曖昧でないこと。P1の「読み取り専用」も別途明示承認を要すること。
3. PR #155/#156の合成環境の証拠と実Supabase未証明を混同しないこと。
4. R1〜R5、A1〜A6がG1〜G8・ACL追補の未検証部分を網羅し、性能・費用・復旧を飛ばしていないこと。
5. 本番OFF・開始時刻null・PR #109 HOLD、iPhone最優先、追加費用0円原則を維持すること。

**本PRはDraftのまま。独立監査＋本人の別途明示承認まではマージ禁止。実Supabase接続・DB変更・実Auth・実HTTP・実FIT・本番ONは一切実施しない。**
