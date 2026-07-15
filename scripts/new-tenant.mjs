#!/usr/bin/env node
// 新しい教室(テナント)の環境を半自動で用意するスクリプト。
//
// やること:
//   1. Cloudflareの workers.dev サブドメインを確認
//   2. D1データベースを作成
//   3. Pagesプロジェクト(管理画面・LIFF)を作成
//   4. tenants/<slug>.json を生成
//   5. (任意)API・管理画面を初回デプロイし、最初のオーナーを作成してAPIキーを表示
//
// LINE関連(公式アカウント作成・シークレット設定・LIFF ID)は顧客の作業が必要なため
// このスクリプトでは行わず、生成した設定ファイルにプレースホルダを入れておく。
//
// 使い方:
//   CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=xxx \
//     node scripts/new-tenant.mjs <slug> "教室名" [--owner="管理者名"] [--no-deploy]
//
//   <slug>: リソース名に使う英小文字・数字・ハイフン(例: mirai-juku)

import { execSync } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const apiDir = path.join(root, "apps", "api");
const tenantsDir = path.join(root, "tenants");
const wrangler = path.join(apiDir, "node_modules", ".bin", "wrangler");

function parseArgs(argv) {
  const positional = [];
  const opts = { owner: "管理者", deploy: true };
  for (const a of argv) {
    if (a === "--no-deploy") opts.deploy = false;
    else if (a.startsWith("--owner=")) opts.owner = a.slice(8);
    else positional.push(a);
  }
  return { positional, opts };
}

function run(cmd, cwd) {
  console.log(`\n$ ${cmd}`);
  return execSync(cmd, { cwd, stdio: ["inherit", "pipe", "inherit"], encoding: "utf-8" });
}

function runInherit(cmd, cwd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

async function cfApi(pathname) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
  });
  return res.json();
}

async function getSubdomain() {
  const acc = process.env.CLOUDFLARE_ACCOUNT_ID;
  const data = await cfApi(`/accounts/${acc}/workers/subdomain`);
  if (!data.success || !data.result?.subdomain) {
    throw new Error(
      "workers.dev サブドメインが未登録です。Cloudflareダッシュボードの Workers & Pages を一度開いて作成してください。"
    );
  }
  return data.result.subdomain;
}

async function main() {
  const { positional, opts } = parseArgs(process.argv.slice(2));
  const slug = positional[0];
  const classroomName = positional[1];

  if (!slug || !classroomName) {
    console.error('使い方: node scripts/new-tenant.mjs <slug> "教室名" [--owner="管理者名"] [--no-deploy]');
    process.exit(1);
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    console.error("slug は英小文字・数字・ハイフンのみ使えます(例: mirai-juku)。");
    process.exit(1);
  }
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
    console.error("環境変数 CLOUDFLARE_API_TOKEN と CLOUDFLARE_ACCOUNT_ID を設定してください。");
    process.exit(1);
  }
  const configPath = path.join(tenantsDir, `${slug}.json`);
  if (existsSync(configPath)) {
    console.error(`tenants/${slug}.json は既に存在します。別の slug を指定するか、既存を確認してください。`);
    process.exit(1);
  }

  const workerName = `sh-${slug}-api`;
  const d1Name = `sh-${slug}`;
  const adminProject = `sh-${slug}-admin`;
  const liffProject = `sh-${slug}-liff`;

  console.log(`\n=== 新規テナント作成: ${classroomName}(${slug})===`);

  console.log("\n--- 1. workers.dev サブドメイン確認 ---");
  const subdomain = await getSubdomain();
  console.log(`サブドメイン: ${subdomain}`);

  console.log("\n--- 2. D1データベース作成 ---");
  let d1Id = "";
  try {
    const out = run(`"${wrangler}" d1 create ${d1Name}`, apiDir);
    console.log(out);
    d1Id = out.match(/database_id\s*=\s*"([0-9a-f-]+)"/i)?.[1] ?? "";
  } catch {
    console.log("作成に失敗(既存の可能性)。IDを検索します...");
  }
  if (!d1Id) {
    const info = run(`"${wrangler}" d1 info ${d1Name} --json`, apiDir);
    d1Id = JSON.parse(info.slice(info.indexOf("{"), info.lastIndexOf("}") + 1)).uuid ?? "";
  }
  if (!d1Id) throw new Error(`D1のIDを取得できませんでした(${d1Name})。`);
  console.log(`D1 ID: ${d1Id}`);

  console.log("\n--- 3. Pagesプロジェクト作成 ---");
  for (const proj of [adminProject, liffProject]) {
    try {
      run(`"${wrangler}" pages project create ${proj} --production-branch=main`, apiDir);
    } catch {
      console.log(`(${proj} は既に存在するか作成をスキップ)`);
    }
  }

  console.log("\n--- 4. 設定ファイル生成 ---");
  const config = {
    id: slug,
    classroom_name: classroomName,
    contact: "",
    cf: {
      worker_name: workerName,
      d1_name: d1Name,
      d1_id: d1Id,
      admin_project: adminProject,
      liff_project: liffProject,
    },
    urls: {
      api: `https://${workerName}.${subdomain}.workers.dev`,
      admin: `https://${adminProject}.pages.dev`,
      liff_direct: `https://${liffProject}.pages.dev`,
    },
    line: {
      liff_id: "REPLACE_AFTER_LINE_SETUP",
      login_channel_id: "REPLACE_AFTER_LINE_SETUP",
    },
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log(`tenants/${slug}.json を作成しました。`);

  if (opts.deploy) {
    console.log("\n--- 5. API・管理画面の初回デプロイ ---");
    runInherit(`node scripts/deploy-tenant.mjs ${slug} --only=api,admin --yes`, root);

    console.log("\n--- 6. 最初のオーナー作成 ---");
    const res = await fetch(`${config.urls.api}/api/setup/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: opts.owner }),
    });
    const data = await res.json();
    if (res.ok && data.api_key) {
      console.log(`\n✅ オーナー「${data.name}」を作成しました。`);
      console.log(`   オーナーAPIキー: ${data.api_key}`);
      console.log("   ※このキーは再表示できません。安全に顧客へ渡してください。");
    } else {
      console.log(`オーナー作成の応答: ${JSON.stringify(data)}`);
    }
  }

  console.log("\n================ 完了 ================");
  console.log(`管理画面: ${config.urls.admin}`);
  console.log(`API     : ${config.urls.api}`);
  console.log("\n【残りの手動作業(LINE連携)】");
  console.log("1. 顧客にLINE公式アカウント作成 + Messaging API有効化をしてもらう(SMS認証は本人のみ)");
  console.log(`2. Webhook URL に ${config.urls.api}/line/webhook を設定`);
  console.log("3. Workerにシークレットを設定(--name でこのテナントのWorkerを指定):");
  console.log(`   printf '<token>'  | npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN --name ${workerName}`);
  console.log(`   printf '<secret>' | npx wrangler secret put LINE_CHANNEL_SECRET --name ${workerName}`);
  console.log("4. LINEログインチャネル + LIFFアプリを作成し、tenants/" + slug + ".json の");
  console.log("   line.liff_id / line.login_channel_id を実際の値に更新");
  console.log(`5. LIFFを含めて再デプロイ: node scripts/deploy-tenant.mjs ${slug}`);
  console.log("\n台帳(docs/TENANTS_LEDGER.md)に1行追記してください。");
}

main().catch((err) => {
  console.error(`\n❌ 失敗: ${err.message}`);
  process.exit(1);
});
