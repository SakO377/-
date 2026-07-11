# School Harness (仮称)

塾・習い事教室向けの、オープンソース(MITライセンス)な運営管理システムです。
[LINE Harness](https://github.com/Shudesu/line-harness-oss) と同じ「セルフホスト型OSS」モデルを踏襲しています。

- 利用料は永久に0円。GitHubで公開されたコードを、自分の Cloudflare アカウントにデプロイして使います
- 生徒・保護者の個人情報は各教室の Cloudflare D1 に保存され、第三者サーバーを経由しません
- 保護者との連絡は LINE 公式アカウント + LIFF で完結します(専用アプリのインストール不要)
- 管理画面の機能はすべて REST API として公開しており、Claude Code や MCP 経由での自然言語操作にも対応します

> **開発ステータス**: MVP(Phase 1)の全機能を実装済みですが、実運用での動作確認はまだです。
> 本番投入前に必ずテストチャネルでLINE連携を含めた一通りの動作確認を行ってください。

## なぜ作るのか

学習塾・ピアノ・英会話・スイミング・ダンス・そろばん・スポーツクラブなど、「習い事教室」の運営管理システムは
有料SaaS(月2〜3万円+オプション課金が相場)しか選択肢がありませんでした。個人・小規模経営の教室が最も重く感じる
固定費を、無料のOSSで置き換えることが目的です。

## できること(Phase 1 / MVP)

| 機能 | 管理画面 | 保護者(LIFF) |
|---|---|---|
| 生徒・保護者・クラス管理 | ○ CRUD | 招待コードでの連携 |
| 入退室管理 | ○ QRリーダー画面・履歴・CSV出力 | プル型の履歴確認(通知OFF時) |
| 欠席・振替連絡 | ○ 振替日提案・確定 | ○ 欠席連絡・振替日の承認 |
| 指導報告書 | ○ テンプレート・作成・送信 | ○ 閲覧・既読管理 |
| お知らせ配信 | ○ 全体/クラス別/タグ別・予約配信 | ○ 閲覧・既読管理 |
| 月謝・請求書 | ○ 作成・印刷(PDF保存)・送信・入金消込 | ○ 閲覧・印刷(PDF保存) |

## 技術スタック

| レイヤー | 技術 |
|---|---|
| 管理画面 (`apps/admin`) | Next.js 15 + Tailwind CSS 4(Cloudflare Pages) |
| API (`apps/api`) | Hono on Cloudflare Workers |
| DB | Cloudflare D1 (SQLite) |
| 保護者側UI (`apps/liff`) | LINE公式アカウント + LIFF |
| 通知 | LINE Messaging API |
| 認証 | 管理画面: APIキー方式 / 保護者: LINE Login (LIFF) |

## リポジトリ構成

```
apps/
  admin/    管理画面 (Next.js)
  api/      REST API (Hono on Cloudflare Workers) + D1マイグレーション
  liff/     保護者向け LIFF アプリ (Next.js)
packages/
  shared/   共有の型定義・定数
scripts/
  setup.mjs 初期セットアップ自動化スクリプト(pnpm setup)
```

## クイックスタート

```bash
pnpm install
pnpm setup   # Cloudflareログイン確認・D1作成・LINE認証情報の入力を対話形式で行う
```

`pnpm setup` は以下を自動化します。

1. `wrangler login`(未ログインの場合のみブラウザが開きます)
2. `wrangler d1 create` でD1データベースを作成し、`apps/api/wrangler.toml` に反映
3. LINE Messaging API / LINE Login の認証情報を聞き取り、`apps/api/.dev.vars` に保存
4. ローカルD1へのマイグレーション適用

完了したら、別々のターミナルで以下を起動します。

```bash
pnpm dev:api      # API    http://localhost:8787
pnpm dev:admin    # 管理画面 http://localhost:3000
pnpm dev:liff     # LIFF   http://localhost:3001
```

管理画面の `http://localhost:3000/setup` から最初のオーナーアカウント(APIキー)を作成してください。
このAPIキーは二度と表示されないので、必ず控えてください。

### 体験用デモモード(登録不要で試す)

機能を手早く試したい・人に見せたい場合は、デモモードを使えます。API側の環境変数
`DEMO_MODE=true` を設定して起動すると、ログイン画面に「デモを試す(ログイン不要)」
ボタンが現れ、ワンクリックで見本データ入りの管理画面に入れます。

```bash
# apps/api/wrangler.toml の DEMO_MODE を "true" にするか、起動時に指定
cd apps/api && npx wrangler dev --var DEMO_MODE:true
```

> **注意:** デモモードは誰でもデータを初期化できてしまうため、**実際の教室運営で使う
> インスタンスでは必ず `DEMO_MODE=false`(既定)にしてください。** デモ用と本番用は
> 別のデプロイに分けることを推奨します。

### Claude Codeに任せてセットアップする場合

非エンジニアの方は、このリポジトリを開いた状態のClaude Codeに次のように依頼すると、対話形式で
セットアップを進めてくれます(LINE Developersコンソールでの操作など、ブラウザ側の作業は自分で行う必要があります)。

```
このリポジトリ(School Harness)を初めてセットアップします。
README.md の「クイックスタート」に沿って、pnpm install と pnpm setup を実行してください。
LINE Developersでの作業(チャネル作成など)が必要な箇所は、何をどこで設定すればよいか
一つずつ具体的に教えてください。
```

## LINE Developersでの事前準備

1. [LINE Developers](https://developers.line.biz/ja/) で「プロバイダー」を作成
2. **Messaging APIチャネル**を作成し、以下を控える
   - チャネルアクセストークン(長期)→ `LINE_CHANNEL_ACCESS_TOKEN`
   - チャネルシークレット → `LINE_CHANNEL_SECRET`
   - Webhook URL に `https://<デプロイ先のドメイン>/line/webhook` を設定し、Webhookの利用をONにする
   - 応答メッセージ・あいさつメッセージは基本OFF推奨(本システムが Reply で応答するため)
3. **LINE Loginチャネル**を作成し、LIFFアプリを追加する
   - LIFFのエンドポイントURLに、デプロイした `apps/liff` のURL(例: `https://liff.example.com/link`)を設定
   - 発行された **LIFF ID** → `apps/liff/.env.example` の `NEXT_PUBLIC_LIFF_ID`
   - **Channel ID**(LINE Loginチャネル自体のID)→ `apps/api/wrangler.toml` の `LIFF_CHANNEL_ID`
     (IDトークンの検証に使用。秘密情報ではないが正しい値に置き換える必要がある)

## 本番デプロイ

```bash
# API (Cloudflare Workers)
cd apps/api
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
npx wrangler secret put LINE_CHANNEL_SECRET
npx wrangler d1 migrations apply school-harness --remote
npx wrangler deploy

# 管理画面 / LIFF (Cloudflare Pages)
cd apps/admin && pnpm build   # .next を Cloudflare Pages に接続してデプロイ
cd apps/liff && pnpm build
```

お知らせの予約配信は Cloudflare Cron Trigger(`apps/api/wrangler.toml` の `[triggers]`)で
5分おきに実行されます。`wrangler deploy` 時に自動的に登録されます。

## 重要な制約: LINE無料メッセージ枠(月200通)

LINE Messaging API の無料枠は月200通の Push 通知までです。生徒30人規模の教室で入退室通知を毎回 Push すると
簡単に超過します(超過するとLINE公式アカウントのライトプラン月5,500円等が必要)。本プロジェクトは以下の設計で対応しています。

- ユーザー操作に対する応答(Reply)は無料・無制限。友だち追加時の案内メッセージなどは常にReplyを使う
- 入退室通知は管理画面(`/attendance`)で機能単位にON/OFFでき、OFF時は保護者がLIFF内の履歴画面で確認する
  プル型にフォールバックする(無料枠を消費しない)
- お知らせ配信はセグメント配信(全体/クラス別/タグ別)で対象を絞れる
- 保護者ごとにPush通知の受信有無を設定でき(既定はON)、OFFの保護者にはPushを送らずアプリ内で確認してもらう
- 送信直前に当月の消費量をチェックし、無料枠(既定200通、`LINE_FREE_PUSH_QUOTA` で変更可)を超える場合は
  自動的に送信をスキップする(保護者はLIFF側のプル型UIで確認可能)
- 管理画面(`/attendance`)に当月の配信数カウンターと無料枠残量を表示する(`line_message_log` テーブルで集計)

**運用の目安**: 生徒30人・保護者1人ずつの教室で入退室のPush通知(入室+退室)を全員ONにすると、
月間で最大 30人 × 2回 × 授業日数 分のPushを消費します。週2回・月8日通塾なら 30 × 2 × 8 = 480通となり、
無料枠(200通)を超えます。**入退室通知はデフォルトOFFにし、お知らせ・報告書・請求書などの重要な連絡を優先する**
運用を推奨します。

## 個人情報の扱い

生徒・保護者の情報は各教室が自分でデプロイした Cloudflare D1 にのみ保存され、開発者を含む第三者のサーバーを経由しません。
管理画面へのアクセスはAPIキー必須で、スタッフのロール(owner/admin/staff)により権限を分離します。

### データのエクスポート・バックアップ

- 入退室履歴は管理画面(`/attendance`)からCSVダウンロードできます
- D1データベース全体のバックアップ・移行には `wrangler d1 export` を使用してください

  ```bash
  npx wrangler d1 export school-harness --remote --output=backup.sql
  ```

- 復元する場合は `wrangler d1 execute school-harness --remote --file=backup.sql` を使用してください

## 開発ロードマップ

- [x] Step 1: リポジトリ初期化(monorepo, wrangler設定, D1マイグレーション基盤)
- [x] Step 2: 生徒・保護者・クラスの CRUD API + 管理画面
- [x] Step 3: LINE連携基盤(Webhook受信、友だち追加→LIFF紐付けフロー)
- [x] Step 4: 欠席・振替連絡(LIFF)
- [x] Step 5: 入退室管理 + LINE通知(配信数カウンター含む)
- [x] Step 6: 指導報告書 / お知らせ一斉配信
- [x] Step 7: 月謝・請求書(印刷HTMLでのPDF保存方式)
- [x] Step 8: セットアップCLI + 非エンジニア向け導入ガイド
- [ ] Step 9: 動作確認後、GitHub公開 (MIT)

### Phase 2以降(未実装)

座席・時間割管理、講師シフト・給与計算、Stripe等の決済連携、成績・テスト管理、複数教室(フランチャイズ)対応、
問い合わせ管理は、いずれもPhase 1のスコープ外です。

## ライセンス

[MIT](./LICENSE)
