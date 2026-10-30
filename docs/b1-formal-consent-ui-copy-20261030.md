# B-1 一般公開版：正式同意UI・日英文面・遷移仕様 v0.1
2026-10-30 / **設計草案のみ。画面・DB更新は未実装。一般公開OFF。**
この文書は独立監査とAtsuoの確認用。現行「参加希望」は正式同意ではない。

## 画面構成（スマートフォン優先）
入口：`region-rings.html` の本人限定画面。現行の「将来の匿名集計への参加希望」欄を維持し、その**下**に「正式公開同意」セクションを別枠として設置する。既存の読み取り専用の説明枠を、仕様確定後に明示的操作UIへ移す。説明を読まずに実行される自動処理は設けない。

### 日本語文面案
**見出し：地域の年輪 ― 匿名集計への正式同意**
説明：
「あなたのランニング記録を、他の参加者の記録と合わせて地域別・期間別の距離の集計に使うことに同意するか選べます。将来公開されるのは、再識別を防ぐために条件を満たした集計結果のみです。個人名、走った道のGPS軌跡、活動日ごとの記録、あなた個人の距離は公開しません。

集計結果は誰でも閲覧できる可能性があります。少人数の地域や期間は非表示または統合し、距離は丸める場合があります。匿名性を完全に保証できるものではありません。

同意は任意で、いつでもこの画面から撤回できます。撤回後は以降の集計対象から除外し、当サービスが管理する公開データやキャッシュを停止・更新する設計です。ただし、第三者が既に保存したスクリーンショットなどを完全に回収することはできません。

この正式同意は、既存の『参加希望』とは別のものです。『参加希望』だけをONにしても正式同意にはなりません。」

確認チェック（初期OFF）：
「公開対象・匿名集計の限界・撤回方法を確認し、正式公開への参加に同意します。」
確定ボタン：「正式同意を登録する」
未同意表示：「正式同意：未登録」
同意済み表示：「正式同意：登録済み（同意日：YYYY年MM月DD日）」
撤回ボタン：「正式同意を撤回する」
撤回確認ダイアログ：「正式同意を撤回しますか？以後の集計から除外し、公開済みデータの再計算・停止を行います。第三者の保存済みコピーは削除できません。」
確認ボタン：「撤回を確定する」／キャンセル：「戻る」
操作完了：「正式同意を登録しました」／「正式同意を撤回しました」
失敗時：「処理を完了できませんでした。状態を確認してからもう一度お試しください。」（成功確認なしに表示を更新しない）

### English copy (draft)
**Title: Regional Growth Rings — Formal Consent for Public Aggregates**
"Choose whether your running activities may contribute to regional and time-period distance totals combined with those of other runners. Only aggregated results that pass our privacy checks may be made public. We will not publish your name, GPS routes, individual activity dates, or your individual running distance.

These aggregates may be visible to anyone. Results for small groups may be withheld or combined, and distance totals may be rounded. Anonymity cannot be guaranteed absolutely.

Participation is optional. You can withdraw your consent here at any time. After withdrawal, your contributions will be excluded from future calculations, and published data and caches under our control will be disabled or refreshed. Copies previously saved by third parties, such as screenshots, cannot be fully recalled.

Formal consent is separate from the existing expression of interest. Turning on the expression of interest does not grant formal consent."

Checkbox (unchecked by default): "I have read the publication scope, privacy limitations, and withdrawal information, and I consent to participating in public aggregated statistics."
Buttons: "Confirm formal consent" / "Withdraw formal consent"
Status: "Formal consent: Not given" / "Formal consent: Active (date: YYYY-MM-DD)"
Withdrawal dialog: "Withdraw formal consent? Your data will be excluded from future calculations, and managed published aggregates will be withdrawn or recalculated. Copies saved by others cannot be deleted."
Confirm / cancel: "Confirm withdrawal" / "Cancel"
Success: "Formal consent saved." / "Formal consent withdrawn."
Failure: "We couldn't complete this action. Please check your status before trying again."

## 遷移・状態（案）
S0: 未ログイン → 情報のみ表示。認証が必要な操作は使えない。
S1: ログイン済み・未同意（既存参加希望ON/OFFは独立）→ 説明と初期OFFチェックのみ。チェックOFFの間、確定ボタン無効。
S2: チェックON → 明示的な「正式同意を登録する」でのみサーバーへ書き込み。二重タップ防止。保存確認後にS3。
S3: 登録済み → バージョン・日時を表示。登録ボタンなし、撤回操作あり。
S4: 撤回確認 → キャンセルはS3のまま。確定・認証確認後に同意無効、失効・公開キャッシュ対策が成立してから成功表示。
S5: 撤回済み → 未同意として表示。再参加には新しい明示的チェック＋確定が必要。
ERROR: 通信失敗時は最後のサーバー確認済み状態を維持し、再取得導線を提供。
VERSION CHANGE: 説明・公開対象に実質変更があれば旧同意を新しい版の同意として流用しない。必要な場合は再同意。
PUBLICATION OFF: 同意が登録されても一般公開を自動ONにしない。

## データ仕様と拒否条件
- 現存 `rr_private.region_rings_public_authorization` を正式同意候補の保存先として使用する設計。ただし現時点ではUIも公開APIも接続しない。権限/RLS、登録・撤回RPC、レース条件、記録版数を独立監査で確定する。
- 正式同意の有効性 = 本人認証、明示チェック、版一致、サーバー保存成功。既存の `public.region_rings_consent` から移行や推定は**禁止**。
- 撤回は先に公開停止できる仕組みが完成するまで有効化しない。仮に同意UIだけ先行実装する場合は**登録・撤回ボタンを表示しない**（説明のみ）。
- 権限のない他人の同意状態は読めない。ログ/解析に個人の経路・同意トークンを出さない。
- 公開前の別条件：地域・月・年・総計の差分推測防止、秘匿セル抑制、公開キャッシュ停止/失効、むせ監査、Atsuo最終承認。

## 独立監査への質問
1. 文面は公開範囲・プライバシー限界・撤回の限界を十分に伝えるか。誤認を招く表現はないか。
2. 未同意→同意済み→撤回→再同意、通信失敗、端末複数、言語切替、版変更で状態の取り違えが起きない設計か。
3. 公開後の撤回について、公開配信の停止とキャッシュの扱いをどの順序で実装・検証すべきか。
4. 完成前の説明のみの画面と、正式に有効な同意取得UIを厳密に分ける方針は妥当か。

**公開動作と正式同意の登録は未実装。監査後に変更を検討する。**
