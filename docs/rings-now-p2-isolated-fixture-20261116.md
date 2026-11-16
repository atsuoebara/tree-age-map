# P2 隔離DB fixture 第1弾 — NOT RUN

このPRは合成データ用の**スキーマ定義と静的契約検査**だけ。Actions workflow、manifest、候補SQL、本番DBは無変更。SQLを適用・実行していない。

- PostgreSQLに `auth.uid()`、`public.runs`、`anon`/`authenticated`/`service_role`、owner RLS、FORCE RLS、最低限のGRANTを作る隔離fixture
- JWTの`sub`はPostgRESTが検証してセットする `request.jwt.claim.sub` を読み取る想定。DB単体でJWT署名を検証するものではない。**PostgREST v14.18が単独GUCを設定するか未確認（S-02 BLOCKED）**。Supabase本番のclaims JSON併読とは差があるため、実HTTP/JWTで検証するまで互換性PASSにしない。単独GUC未設定ならuidはNULLとなり、結果0行になる想定
- `service_role` BYPASSRLSは**テスト用の危険な権限差分**として明記。PostgRESTのauthenticator roleとmembership、実際のACLは後続で実測する
- `public.runs`の型はテスト用仮定。Supabase本番型の完全一致は未証明。候補SQLの原本は別ファイルのまま保つ
- 次工程: 合成ユーザーA/B、0/1000/1001件、NULL、時刻境界、並行更新のfixtureと、実Auth/PostgREST起動コードを追加する
- 依存digest、実JWT、実HTTP、請求画面、P2 A1〜A6は未確認。PR #174のhard stopは維持

**重要**: このSQLは一時DB以外に適用禁止。むせ監査後も自動実行・P2実行を認めるものではない。
