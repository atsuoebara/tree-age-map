# Rings Now P2 — A4 性能測定・負荷上限ゲート v0.1（NOT RUN）

2026-11-17／**設計のみ・実行禁止**。むせ追補97（PR #179）の観察1「A4が独立ゲートになっていない」に対応するため、A4をG1〜G5およびH1〜H6とは独立に整理する。既存本番・DB・CI・workflow・manifestへの変更は行わない。

## A4の目的と実証範囲

- A4は、合成データを用いた**使い捨てGitHub Actions runner内のPostgREST HTTP/RPC応答時間**を記録する項目。GoTrueログイン、コンテナpull/起動、候補SQL適用、ジョブの待ち時間はRPC応答時間に混ぜない。全体ジョブ時間は別途記録する。
- **本番Supabase Pro Microの性能、端末での1km解析速度、実走FITの処理性能を証明しない**。実測がない段階ではA4=NOT RUN。速度が良くてもA1〜A3・A5〜A6の正当性を代替しない。
- 閾値（例えば「何秒なら速い」）は**未設定**。勝手な本番SLAを導入しない。試験前に許容上限と停止条件を定め、むせ監査・Atsuo個別承認を得る。計測だけで「性能合格」とはしない。

## A4 実行前の独立ゲート（すべて未承認）

| ID | 必須条件 | 未完了時 |
|---|---|---|
| A4-G1 | G1〜G5（digest実証・費用条件・隔離/cleanup・実行HEAD独立監査・本人の個別実行承認）が成立 | A4=NOT RUN |
| A4-G2 | サービス/SQL fixtureの同一HEAD・PG/PostgREST/GoTrueの不変digest・runner種別・UTC/JST時刻・計測器版を固定 | A4=NOT RUN |
| A4-G3 | **最大対象件数1001件**（SQLの1000件上限と1001件拒否境界の確認）。無制限のINSERT、任意の追加行数、連続負荷を禁止 | A4=NOT RUN |
| A4-G4 | **単発RPCのみ、同時接続数1**。計測候補は0/1000/1001件の固定3条件、各条件最大3回（最大9呼出し）。実行回数・反復数は事前個別承認の上限を超えない | A4=NOT RUN |
| A4-G5 | 1 HTTP要求のソケットtimeout 3秒・絶対期限5秒、ジョブ全体timeout上限10分、失敗時cleanupと未片付け判定を定義。既存transportの3s/5sを参照するが、**実runnerへの接続と効力は未実証** | A4=NOT RUN |
| A4-G6 | 実行先がlocalhostまたは監査された隔離内部のみである証拠、匿名/他人の漏えいなし、機密を残さないログ方式を固定 | A4=NOT RUN |
| A4-G7 | 記録する測定方法・期待値・エラー分類を実行前に凍結。ストレージ追加費用と成果物保持量の条件を確認 | A4=NOT RUN |

**上記の件数・反復数・同時数は「今すぐ実行してよい許可値」ではなく、将来の設計上の提案上限。** さらに低い負荷を選択できる。既存のP2合成シナリオの実行結果をA4の実測と取り違えない。

## 測定手順（承認後に別工程で実装）

1. 合成fixture準備と健康確認を計測区間の**外**で実施し、正しいowner/JWT/RLSかA1〜A3の別項目で確認。成功応答しか測らないのではなく、拒否応答も理由を区別する。
2. 同一の一時環境・同一のHTTPクライアントで、各RPCの**送信開始直前からレスポンス全体の受信完了まで**を単調時計で測定する。HTTP status・応答種別・期待行数・受信バイト数も記録。時計はwall-clock/JST表記を性能計測に使わない。
3. 0/1000/1001件を固定順序で各最大3回。条件によるキャッシュ・ウォームアップの影響は観察として明記し、反復数が3回以下のためp95/p99を計算して「統計的に優位」と主張しない。
4. 条件ごとにmin/median/maxと個々の実測値（ms）、失敗件数、timeout件数を報告。件数1～2の場合はそのまま個別値を示し、不成立の統計値を埋めない。
5. 候補SQLの1001件時の`too_many_rows`など**応答の意味論をA3として別判定**。早くても拒否漏れや誤認可があれば性能値の良否に関係なくP2の成功としない。
6. timeout・サービス応答異常・他人の行・不明な追加費用・予期せぬ外部アクセスはfail-closed。全ケース終了または中断の後、cleanupと残留検証を別途記録する。
7. 事後にrunner型・checkout SHA・実行時刻・依存digest・費用・本番OFF/null/#109 HOLDを照合。cleanup未確認ならA4もPASS禁止。

## 実測結果の最低限の記録欄（未実行）

| 項目 | 現状 |
|---|---|
| 実行日時とHEAD | NOT RUN |
| 費用証拠と承認ID | NOT VERIFIED / NOT APPROVED |
| runner・依存digest・fixture版 | NOT RUN |
| 0件／1000件／1001件 HTTP status、応答種別、個別ms、受信bytes | NOT RUN |
| min／median／max、失敗/timeout数 | NOT RUN |
| cleanup結果・請求事後確認 | NOT RUN |
| A4結論 | **NOT RUN** |

## 引き継ぎと制限

- PR #179のG2表は`NOT VERIFIED`だが、後続の本人提示画面とPRコメントにより「当月Actions請求額$0、予算$0、Usage blocked」が観測されている。**現在の請求確認と将来の追加費用0円保証を分ける**。G2が完全PASSになったとは扱わない。
- むせ追補98：PR #180 cleanup契約はhang/timeoutを制御しない。A4ではrunner側で別途timeoutと強制中断後の状態を監査する。
- むせ追補99：PR #181の`auth.uid()`候補単体にはPUBLIC EXECUTEが残る。実fixture組込時は#176のREVOKE/GRANTを必須にし、A4前のA1実認証を省かない。
- 本書は**起動コード・実行許可・A4合格証拠ではない**。PR #109 HOLD、featureStartedAtMs=null、本番OFF、workflow `if: ${{ false }}`、manifest `BLOCKED_NOT_RUN`を維持。
