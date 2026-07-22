# 顧客環境 管理台帳(設置代行用テンプレート)

設置代行で提供している教室(テナント)の環境を一覧管理するための台帳です。
新しい教室を導入したら1行追加し、廃止したら「状態」を更新します。

> **重要:このファイルにシークレット(LINEアクセストークン・チャネルシークレット・
> オーナーAPIキー)を書かないこと。** それらは各Workerの `wrangler secret` に保存されており、
> ここに書くと漏洩リスクになります。この台帳には「どこにあるか」だけを書きます。

---

## 教室一覧

| 教室名 | 教室ID(tenant id) | 導入日 | 状態 | プラン | 連絡先 |
|---|---|---|---|---|---|
| サンプル教室 | example | 2026-07-15 | 稼働中 | 設置代行 | example@example.com |
|  |  |  |  |  |  |

- **状態**: 稼働中 / 停止中 / 解約
- **教室ID**: `tenants/<教室ID>.json` のファイル名と一致させる(英数字・ハイフン)

## 各教室の技術情報

| 教室ID | Worker名 | D1名 | D1 ID | 管理画面URL | LIFF ID |
|---|---|---|---|---|---|
| example | sh-example-api | sh-example | (D1のID) | https://sh-example-admin.pages.dev | 0000000000-xxxxxxxx |
|  |  |  |  |  |  |

## LINE連携情報(シークレットは含めない)

| 教室ID | 公式アカウント名 | ベーシックID | LINEログイン チャネルID | LINEトークンの保管場所 |
|---|---|---|---|---|
| example | サンプル教室 | @xxxxxxx | 0000000000 | Worker `sh-example-api` の secret |
|  |  |  |  |  |

---

## 運用メモ

### 環境の作り方(新規1軒)

**推奨: 半自動スクリプトを使う**(D1作成・Pages作成・設定生成・初回デプロイ・オーナー作成まで)
```
export CLOUDFLARE_API_TOKEN=xxxxx CLOUDFLARE_ACCOUNT_ID=xxxxx
node scripts/new-tenant.mjs <slug> "教室名"
# 例: node scripts/new-tenant.mjs mirai-juku "みらい学習教室"
```
実行後、管理画面はすぐ使えます(生徒登録などが可能)。オーナーAPIキーが表示されるので安全に顧客へ渡します。

**残りの手動作業(LINE連携)**
1. 顧客にLINE公式アカウント作成 + Messaging API有効化をしてもらう(SMS認証は本人のみ)。
   Webhook・LIFF・トークン発行は管理者に招待してもらいこちらで実施。
2. Workerにシークレットを設定(`--name` でそのテナントのWorkerを指定):
   ```
   printf '<token>'  | npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN --name sh-<slug>-api
   printf '<secret>' | npx wrangler secret put LINE_CHANNEL_SECRET      --name sh-<slug>-api
   ```
3. LINEログインチャネル + LIFFアプリを作成し、`tenants/<slug>.json` の
   `line.liff_id` と `line.login_channel_id` を実際の値に更新。
4. LIFFを含めて再デプロイ: `node scripts/deploy-tenant.mjs <slug>`
5. 疎通確認: `node scripts/check-tenant.mjs <slug>`(全項目 ✅ を確認)

### 更新の仕方(コード改善を反映)
```
export CLOUDFLARE_API_TOKEN=xxxxx
export CLOUDFLARE_ACCOUNT_ID=xxxxx

# 1軒だけ更新(API・管理画面・LIFF・マイグレーションを一括)
node scripts/deploy-tenant.mjs <教室ID>

# 全教室をまとめて更新
node scripts/deploy-tenant.mjs all --yes

# 管理画面だけ / マイグレーションなし、など部分更新
node scripts/deploy-tenant.mjs <教室ID> --only=admin --skip-migrate
```

### 疎通確認(導入後・更新後)
```
node scripts/check-tenant.mjs <教室ID>   # 1軒
node scripts/check-tenant.mjs all         # 全教室(異常があれば終了コード1)
```
API・DB・管理画面・LIFF・LINE設定状況を ✅/⚠️/❌ で表示します。

### 破壊的変更・DBスキーマ変更のとき
- 列の追加(マイグレーション)は安全。列の削除・型変更は既存データに影響するので、
  まず1軒(またはデモ環境)で試してから `all` で流す。
- バックアップ: `wrangler d1 export sh-<教室ID> --remote --output=backup-<教室ID>-YYYYMMDD.sql`

### チェックリスト(導入時)
- [ ] D1作成・`tenants/<id>.json` 作成
- [ ] LINE公式アカウント作成(顧客)・管理者招待
- [ ] Webhook URL 設定・検証成功
- [ ] LINEシークレットを Worker に設定
- [ ] LIFFアプリ作成(エンドポイント=そのテナントのLIFF URL)
- [ ] 初回デプロイ・オーナー作成・APIキー受け渡し
- [ ] 友だち追加→連携→欠席連絡→管理画面に届く、まで実機で疎通確認
- [ ] 台帳に1行追記
