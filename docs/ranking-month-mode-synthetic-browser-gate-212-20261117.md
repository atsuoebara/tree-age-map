# PR #212 — 合成Chromium画面テスト追加（2026-11-17）

## 検証対象と隔離
- `scripts/test-ranking-integration-browser-212.cjs`: 375×812のChromiumで、**ローカルの `ranking.html`** を開く。Supabase SDK自体を架空のRPCを返すスクリプトに差し替え、外部URLは空レスポンスにする。ログインは架空の未ログイン状態で、本番のDB・ユーザーデータ・APIへはアクセスしない。
- `.github/workflows/ranking-integration-browser-212.yml`: pull_request対象3パス／手動だけのActions。権限は `contents:read`、secretsなし。Node20とピン止めPlaywright、ChromiumをActions環境に導入し、テストする。

## テストで狙う条件
1. 月間モードボタンOFF／disabled維持、月間の新RPCは全く呼ばれない。
2. 年間DISTANCE/EXPLORE/NATIONS RPCを選択年と月で呼ぶ。
3. NATIONSの月間セルは作らず、架空API応答に `month_km:310.1` が入っていてもキャッシュには `null` で保存する。
4. DISTANCEの月間増加分とEXPLOREの月間増加分は従来どおり表示。
5. 日本語→英語、年/月切替、国別パネル切替、375px横スクロールなし、ページ例外なし。

## 未検証（これだけで完成と呼ばない）
- Playwrightを実際に走らせた結果がCI SUCCESSになるまで**実行合格としない**。
- 月間モードはHARD OFFのため、切替をONにした際のUI・SQL統合はまだ未検証。
- iPhoneのSafari実機、共有画像、検索、応答逆転、旧ローカルキャッシュの既存内容を持つ端末、実PostgREST HTTPなどは別工程。
- **PR #208のDB先行適用→実HTTP月間NULL確認→UI配信**を変更しない。PR #206の月間RPC適用・ONには別途明示承認が必要。
- PR #212をmainへ直接マージせず、PR #206/#211とのスタックとPR #208の衝突を監査する。

## むせへの独立監査
ブラウザテストの外部遮断と架空SDKのみに依存すること、375px/日英/年/月/3部門/キャッシュ/nullの被覆、実行結果URLとHEAD照合を確認。未検証の範囲を過大に合格扱いしない。
