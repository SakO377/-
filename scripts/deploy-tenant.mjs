#!/usr/bin/env node
// 顧客(教室)1軒の環境を一発で最新化するデプロイスクリプト。
//
// 使い方:
//   CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=xxx \
//     node scripts/deploy-tenant.mjs <教室ID> [オプション]
//   node scripts/deploy-tenant.mjs all           # tenants/ 内の全教室を順に更新
//
// オプション:
//   --only=api,admin,liff   更新対象を限定(既定: 全部)
//   --skip-migrate          DBマイグレーションを実行しない
//   --yes                   確認プロンプトを省略
//
// 前提: tenants/<教室ID>.json に設定を用意しておくこと(tenants/example.json 参照)。
// LINEのシークレット(アクセストークン/チャネルシークレット)は本スクリプトでは触りません
// (初回に `wrangler secret put` で各Workerに設定済みである前提)。

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const apiDir = path.join(root, "apps", "api");
const adminDir = path.join(root, "apps", "admin");
const liffDir = path.join(root, "apps", "liff");
const tenantsDir = path.join(root, "tenants");
const prodTomlPath = path.join(apiDir, "wrangler.prod.toml");
// v4のPages自動移行(OpenNext化)を避けるため、apps/api にある wrangler v3 を明示的に使う
const wrangler = path.join(apiDir, "node_modules", ".bin", "wrangler");

function parseArgs(argv) {
  const positional = [];
  const opts = { only: null, skipMigrate: false, yes: false };
  for (const a of argv) {
    if (a === "--skip-migrate") opts.skipMigrate = true;
    else if (a === "--yes" || a === "-y") opts.yes = true;
    else if (a.startsWith("--only=")) opts.only = a.slice(7).split(",").map((s) => s.trim());
    else positional.push(a);
  }
  return { positional, opts };
}

function run(cmd, cwd, extraEnv = {}) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, ...extraEnv } });
}

function loadTenant(id) {
  const file = path.join(tenantsDir, `${id}.json`);
  if (!existsSync(file)) {
    throw new Error(`設定ファイルが見つかりません: tenants/${id}.json`);
  }
  const t = JSON.parse(readFileSync(file, "utf-8"));
  for (const key of ["cf", "urls", "line"]) {
    if (!t[key]) throw new Error(`tenants/${id}.json に "${key}" がありません`);
  }
  if (!t.cf.d1_id || t.cf.d1_id.startsWith("REPLACE")) {
    throw new Error(`tenants/${id}.json の cf.d1_id が未設定です`);
  }
  return t;
}

// 本番テンプレート(wrangler.prod.toml)から、この教室専用の一時的な wrangler 設定を生成する。
// main / migrations_dir が正しく解決されるよう apps/api 直下に置く。
function writeTenantToml(t) {
  let toml = readFileSync(prodTomlPath, "utf-8");
  toml = toml
    .replace(/^name = ".*"/m, `name = "${t.cf.worker_name}"`)
    .replace(/database_name = ".*"/, `database_name = "${t.cf.d1_name}"`)
    .replace(/database_id = ".*"/, `database_id = "${t.cf.d1_id}"`)
    .replace(/LIFF_CHANNEL_ID = ".*"/, `LIFF_CHANNEL_ID = "${t.line.login_channel_id}"`)
    .replace(
      /ALLOWED_ORIGINS = ".*"/,
      `ALLOWED_ORIGINS = "${t.urls.admin},${t.urls.liff_direct}"`
    );
  const outPath = path.join(apiDir, `.tenant.${t.id}.toml`);
  writeFileSync(outPath, toml);
  return outPath;
}

async function confirm(message) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ans = (await rl.question(`${message} [y/N]: `)).trim().toLowerCase();
  rl.close();
  return ans === "y" || ans === "yes";
}

async function deployTenant(id, opts) {
  const t = loadTenant(id);
  const targets = opts.only ?? ["api", "admin", "liff"];
  console.log(`\n================ ${t.classroom_name}(${id})================`);
  console.log(`対象: ${targets.join(", ")}${opts.skipMigrate ? "(マイグレーションなし)" : ""}`);
  console.log(`API : ${t.urls.api}`);
  console.log(`管理 : ${t.urls.admin}`);
  console.log(`LIFF: ${t.urls.liff_direct}`);

  const tomlPath = writeTenantToml(t);
  const tomlRel = path.relative(apiDir, tomlPath);
  try {
    if (targets.includes("api")) {
      if (!opts.skipMigrate) {
        run(`"${wrangler}" d1 migrations apply ${t.cf.d1_name} --remote --config ${tomlRel}`, apiDir);
      }
      run(`"${wrangler}" deploy --config ${tomlRel}`, apiDir);
    }
    if (targets.includes("admin")) {
      run(`pnpm --filter @school-harness/admin build`, root, {
        NEXT_PUBLIC_API_BASE_URL: t.urls.api,
      });
      run(
        `"${wrangler}" pages deploy ${path.join(adminDir, "out")} --project-name=${t.cf.admin_project} --branch=main --commit-dirty=true`,
        root
      );
    }
    if (targets.includes("liff")) {
      run(`pnpm --filter @school-harness/liff build`, root, {
        NEXT_PUBLIC_API_BASE_URL: t.urls.api,
        NEXT_PUBLIC_LIFF_ID: t.line.liff_id,
      });
      run(
        `"${wrangler}" pages deploy ${path.join(liffDir, "out")} --project-name=${t.cf.liff_project} --branch=main --commit-dirty=true`,
        root
      );
    }
  } finally {
    rmSync(tomlPath, { force: true });
  }
  console.log(`\n✅ ${t.classroom_name}(${id})を更新しました。`);
}

async function main() {
  const { positional, opts } = parseArgs(process.argv.slice(2));
  const target = positional[0];

  if (!target) {
    console.error("使い方: node scripts/deploy-tenant.mjs <教室ID | all> [--only=api,admin,liff] [--skip-migrate] [--yes]");
    process.exit(1);
  }
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
    console.error("環境変数 CLOUDFLARE_API_TOKEN と CLOUDFLARE_ACCOUNT_ID を設定してください。");
    process.exit(1);
  }

  let ids;
  if (target === "all") {
    ids = readdirSync(tenantsDir)
      .filter((f) => f.endsWith(".json") && f !== "example.json")
      .map((f) => f.replace(/\.json$/, ""));
    if (ids.length === 0) {
      console.error("tenants/ に更新対象の教室設定がありません(example.json は対象外)。");
      process.exit(1);
    }
  } else {
    ids = [target];
  }

  console.log(`更新対象: ${ids.join(", ")}`);
  if (!opts.yes && !(await confirm("この内容でデプロイしますか?"))) {
    console.log("中止しました。");
    return;
  }

  const results = [];
  for (const id of ids) {
    try {
      await deployTenant(id, opts);
      results.push({ id, ok: true });
    } catch (err) {
      console.error(`\n❌ ${id} の更新に失敗: ${err.message}`);
      results.push({ id, ok: false, error: err.message });
    }
  }

  console.log("\n================ 結果 ================");
  for (const r of results) {
    console.log(`${r.ok ? "✅" : "❌"} ${r.id}${r.ok ? "" : ` — ${r.error}`}`);
  }
  if (results.some((r) => !r.ok)) process.exit(1);
}

main();
