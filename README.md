# School Harness (仮称)

塾・習い事教室向けの、オープンソース(MITライセンス)な運営管理システムです。
[LINE Harness](https://github.com/Shudesu/line-harness-oss) と同じ「セルフホスト型OSS」モデルを踏襲しています。

- 利用料は永久に0円。GitHubで公開されたコードを、自分の Cloudflare アカウントにデプロイして使います
- 生徒・保護者の個人情報は各教室の Cloudflare D1 に保存され、第三者サーバーを経由しません
- 保護者との連絡は LINE 公式アカウント + LIFF で完結します(専用アプリのインストール不要)
- 管理画面の機能はすべて REST API として公開しており、Claude Code や MCP 経由での自然言語操作にも対応します

> **開発ステータス**: 実装初期段階です。まだ本番利用できる機能はありません。

## なぜ作るのか

学習塾・ピアノ・英会話・スイミング・ダンス・そろばん・スポーツクラブなど、「習い事教室」の運営管理システムは
有料SaaS(月2〜3万円+オプション課金が相場)しか選択肢がありませんでした。個人・小規模経営の教室が最も重く感じる
固定費を、無料のOSSで置き換えることが目的です。

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
```

## セットアップ (開発環境)

```bash
pnpm install

# API (Cloudflare Workers, ローカルD1)
pnpm --filter @school-harness/api db:migrate:local
pnpm dev:api      # http://localhost:8787

# 管理画面
pnpm dev:admin    # http://localhost:3000

# 保護者向け LIFF アプリ
pnpm dev:liff
```

LINE連携機能を使うには、LINE Developers で Messaging API チャネルと LINE Login (LIFF) チャネルを作成し、
`apps/api/.dev.vars.example` を参考に `.dev.vars` を用意してください(手順の詳細は今後のステップで追記します)。

## 重要な制約: LINE無料メッセージ枠(月200通)

LINE Messaging API の無料枠は月200通の Push 通知までです。生徒30人規模の教室で入退室通知を毎回 Push すると
簡単に超過します。本プロジェクトは以下の設計でこれに対応します。

- ユーザー操作に対する応答 (Reply) は無料・無制限。操作起点のやり取りは常に Reply を使う
- 入退室通知などの通知系は機能単位で Push のON/OFFを設定可能にし、OFF時はLIFF内の履歴画面で確認できるプル型にフォールバック
- 一斉配信はセグメント配信(ナローキャスト)で対象を絞る
- 管理画面に当月の配信数カウンターと無料枠残量を表示する(`line_message_log` テーブルで集計)

無料枠に収めるための詳細な運用ガイドは、通知機能の実装が進んだ段階で本READMEに追記します。

## 個人情報の扱い

生徒・保護者の情報は各教室が自分でデプロイした Cloudflare D1 にのみ保存され、開発者を含む第三者のサーバーを経由しません。
管理画面へのアクセスはAPIキー必須で、スタッフのロール(owner/admin/staff)により権限を分離します。

## 開発ロードマップ

- [x] Step 1: リポジトリ初期化(monorepo, wrangler設定, D1マイグレーション基盤)
- [ ] Step 2: 生徒・保護者・クラスの CRUD API + 管理画面
- [ ] Step 3: LINE連携基盤(Webhook受信、友だち追加→LIFF紐付けフロー)
- [ ] Step 4: 欠席・振替連絡(LIFF)
- [ ] Step 5: 入退室管理 + LINE通知(配信数カウンター含む)
- [ ] Step 6: 指導報告書 / お知らせ一斉配信
- [ ] Step 7: 月謝・請求書PDF生成
- [ ] Step 8: セットアップCLI + 非エンジニア向け導入ガイド
- [ ] Step 9: GitHub公開 (MIT)

## ライセンス

[MIT](./LICENSE)
