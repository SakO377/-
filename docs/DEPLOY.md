# デプロイ手順(Cloudflare)

School Harness を Cloudflare にデプロイする手順です。3つのアプリを次のように配置します。

| アプリ | 配置先 | 形態 |
|---|---|---|
| API (`apps/api`) | Cloudflare Workers + D1 | サーバー(Hono) |
| 管理画面 (`apps/admin`) | Cloudflare Pages | 静的ファイル(`out/`) |
| 保護者用LIFF (`apps/liff`) | Cloudflare Pages | 静的ファイル(`out/`) |

管理画面・LIFF は静的エクスポート(`output: "export"`)なので、サーバーランタイム不要で
Cloudflare Pages の無料枠にそのまま置けます。

前提: [Node.js 20+ / pnpm](../README.md) と Cloudflareアカウント(無料)。

---

## デモ環境をURL化する(最短ルート)

「登録不要で触れるデモ」を公開する手順です。**本番用とは別のプロジェクトとして** 作ってください
(デモは誰でもデータを初期化できるため)。

### 1. Cloudflare にログイン

```bash
cd apps/api
npx wrangler login   # ブラウザが開くので承認する
```

### 2. デモ用の D1 データベースを作成

```bash
npx wrangler d1 create school-harness-demo
```

出力された `database_id` を `apps/api/wrangler.toml` の `database_id` に貼り付け、
`database_name` も `school-harness-demo` に変更します。あわせて `[vars]` の
`DEMO_MODE` を `"true"` に、`ALLOWED_ORIGINS` は後で決めるので一旦 `"*"` のままにします。

### 3. マイグレーションを本番D1へ適用

```bash
npx wrangler d1 migrations apply school-harness-demo --remote
```

### 4. API(Workers)をデプロイ

```bash
npx wrangler deploy
```

デプロイ後に表示される URL(例: `https://school-harness-api.<あなた>.workers.dev`)を控えます。
これが **APIのURL** です。LINE連携を使わないデモなら、LINEのシークレットは未設定で構いません
(通知系は送信されないだけで、画面の閲覧・操作はすべて動きます)。

### 5. 管理画面(静的)をビルドして Pages へデプロイ

`NEXT_PUBLIC_API_BASE_URL` に手順4のAPI URLを指定してビルドします。

```bash
cd ../admin
NEXT_PUBLIC_API_BASE_URL="https://school-harness-api.<あなた>.workers.dev" pnpm build
npx wrangler pages deploy out --project-name=school-harness-demo-admin
```

初回は Pages プロジェクトの作成を聞かれるので指示に従ってください。
完了すると **管理画面のURL**(例: `https://school-harness-demo-admin.pages.dev`)が発行されます。
これを相手に送れば、ログイン画面の「デモを試す(ログイン不要)」からその場で触ってもらえます。

### 6. (任意)保護者用LIFFもデプロイ

LINE連携ありのデモを見せる場合のみ必要です(閲覧デモだけなら不要)。

```bash
cd ../liff
NEXT_PUBLIC_API_BASE_URL="https://school-harness-api.<あなた>.workers.dev" \
NEXT_PUBLIC_LIFF_ID="<LINE LoginのLIFF ID>" pnpm build
npx wrangler pages deploy out --project-name=school-harness-demo-liff
```

### 7. CORS を絞る(推奨)

デモが動いたら、`apps/api/wrangler.toml` の `ALLOWED_ORIGINS` を管理画面・LIFFのURLに変更し、
`npx wrangler deploy` で再デプロイすると、他サイトからのAPI利用を防げます。

```toml
ALLOWED_ORIGINS = "https://school-harness-demo-admin.pages.dev"
```

---

## 本番(実際の教室運営)デプロイの注意点

デモとの違いは次の3点です。

1. **`DEMO_MODE` は必ず `"false"`(既定)にする** — 見本データ投入エンドポイントを無効化します。
   最初の管理者は、管理画面の `/setup` から作成してください。
2. **LINEのシークレットを設定する** — 通知・LIFFを使うため必須です。
   ```bash
   cd apps/api
   npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
   npx wrangler secret put LINE_CHANNEL_SECRET
   ```
   `wrangler.toml` の `LIFF_CHANNEL_ID` も LINE Login チャネルのIDに設定します。
3. **`ALLOWED_ORIGINS` を自ドメインに限定する** — `"*"` のままにしない。

D1のバックアップは `npx wrangler d1 export <db名> --remote --output=backup.sql` で取得できます。

---

## よくあるつまずき

- **管理画面のAPIキー方式**: 静的サイトなので、APIのURLは「ビルド時」に `NEXT_PUBLIC_API_BASE_URL`
  で埋め込まれます。API URLを変えたら **再ビルドして再デプロイ** してください。
- **CORSエラーで画面が真っ白/データが出ない**: `ALLOWED_ORIGINS` に管理画面のURLが
  含まれているか確認してください。
- **`wrangler d1 migrations apply` を `--remote` なしで実行**: ローカルDBにしか適用されません。
  本番反映には必ず `--remote` を付けます。
