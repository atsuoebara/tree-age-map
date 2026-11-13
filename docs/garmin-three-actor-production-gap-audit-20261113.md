# Garmin OAuth / Push / DB の本番組込差分ギャップ検査（2026-11-13）
状態：**Draft PR #67 / 読み取り専用・隔離CI / 本番適用No-Go**

## 今回の変更
- `src/garmin-three-actor-source-gap-audit.mjs`：ソース文字列の存在・不足を列挙する静的ギャップ検査。実装・書込・remote操作はしない。
- `tests/garmin-three-actor-source-gap-audit.test.mjs`：PRの現行OAuth/Push/隔離SQL/復旧判定を実際に読み込み、5点について「証拠はあるが未統合」を確認。空ソースでは `evidence_missing`、架空の保護済みソースでは `implemented` を識別できることもテスト。
- `.github/workflows/garmin-sample-shape-probe.yml` に専用CI追加。

## 5つの実装差分・監査ゲート
1. **manual /disconnect**：最初の `import_enabled=false` PATCHがownerのみを条件にしている。初回PATCHにも旧`connection_version`とのCASが要る。現行の後続SELECT/DELETE世代フェンスは先行PATCHを保護しない。
2. **OAuth /callback**：Garminトークン取得とupsert後に、新旧同意世代を同一owner上で原子的に確定・保留するRPCが存在しない。古い遠隔DELETEが飛行中なら新連携の自動有効化を止める設計が必要。
3. **Push worker**：Worker leaseは存在するが、旧世代のremote `DELETE /registration` 直前に、3経路共通のowner+generation+attemptの永続claimを行っていない。旧DELETE結果不明時には自動再送を許可できない。
4. **DB**：`consent_lease_ci`はPostgreSQL16の隔離試験専用で、本番スキーマに検証済みのUNKNOWN復旧RPCはない。SQL移植やproduction権限付与は未承認。
5. **recovery decision**：`reviewUnknownRevoke`はread-only pure function。OAuth/worker両方から利用される共有の復旧RPCには接続していない。provider回答前に外部結果を自動推定・保留同意を復活させない。

## 検査方式の制約
この検査は**静的な既知コードパターンの存在チェック**。動的な実行トレース、並行性の完全な証明、認証・権限/RLS・外部Garmin意味論の確認にはならない。保護済みmockを検出しても、本番安全の証明ではない。生コードの変形・本番Patchは行っていない。保護導入後はギャップを検出するテストを更新する必要がある。

## 統合の安全な順序（未実装）
1. Garmin公式書面で旧Token DELETEのスコープ/タイムアウト意味論を確認。
2. owner単位の状態遷移・RPCを現行実スキーマ/ロールと照合し、変更前に隔離PostgreSQLの競合・停止試験。
3. 手動解除の取込停止を世代CAS化し、remoteを送る前の永続claimを統一。
4. callback側は新認可を古いremote-inflight/UNKNOWNと競合させず、保留にする。旧Code再利用は禁止。
5. workerも同じclaim/complete/unknownに統一し、非確定時はfail-closed。
6. 年輪、runs、inbox/ACK、Strava及び通常FITとの非退行、無料枠、スマホ表示、監査ログ、既存の削除ポリシーを検査。
7. むせ独立監査と本人の明示承認なしにマージ/本番適用しない。

## 結論
本番適用可否：**No-Go**。本番のGarmin OAuth/receiver/DB/年輪への変更ゼロ、実接続・API呼び出し・保存済みランへの操作なし。PR #67 Draft、#68 HOLD。
