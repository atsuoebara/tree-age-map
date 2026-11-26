# Rings Now 利用画面と制御通信の候補
PR #349 / #350の既存部品を使用する。トップページの認証・広告・他機能からFIT処理を分離するため、sandbox=allow-scriptsのみのopaque-origin iframeとした。トップと子の接続は対象frame windowへのMessageChannel転送後、固定メッセージのみ。子に本人ID・実ランID・認証トークンは渡さず、親の確定済み行に拘束したローカル用識別子と開始時刻・日付・距離を渡す。親が選択の一致・寿命を監視する。子は結果やFITを親へ送らない。CSP connect-src none、外部画像・フォーム・worker禁止。これは静的境界であり、Safari実動作や通信完全不存在の証明ではない。
 
制御通信は親のみ、既存Supabaseの専用関数候補へ固定JSONをPOSTする。Cookie・個人JWT・FIT・ラン識別子を送らず、redirect禁止、no-store、3秒timeout、128byte応答上限、厳密な応答形式。関数は正規originへのCORSのみ候補として追加し、応答は常にenabled=false。Originは認証ではなく、IP等のメタデータは残り得る。verify_jwt=falseの候補設定はこの関数だけ。実配備なし。制御の匿名公開濫用・使用量・ログの扱いは実配備判断前に確認する。
 
入口OFF、開始時刻null、親の実FIT許可OFF、子の実FIT許可OFF、関数常時拒否。新HTMLはマージ後静的配信され得るが、直接アクセスや現行フラグではファイル入力自体を生成しない。実FIT使用・正式公開を許可しない。版番号は2026.11.20.04に同期。
 
未実証：opaque iframeでGitHub Pagesのmodule CORSが許可されるか、SafariのMessageChannel・ファイル選択・復帰、実制御のgateway/CORS/ログ/停止手順、全依存の通信経路、実FITの品質。旧タブ完全停止の保証なし。実FIT同一活動は本人の確認であり、暗号学的な証明ではない。英語UIの既存解析結果メッセージは従来の日本語が残る。正式提供前に揃える。実際の配信・iPhone・実FIT・本番ONは個別に承認する。
