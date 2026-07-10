#!/usr/bin/env node
// School Harness の初期セットアップを自動化するスクリプト。
// Cloudflareへのログイン確認 → D1データベース作成 → wrangler.tomlへの反映 →
// LINE認証情報の入力(.dev.vars作成)→ ローカルマイグレーション適用、を対話形式で行う。
// 非エンジニアの方は、このスクリプトの内容をそのままClaude Codeに実行を依頼しても構いません。

import { execSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.join(__dirname, "..", "apps", "api");
const wranglerTomlPath = path.join(apiDir, "wrangler.toml");
const devVarsPath = path.join(apiDir, ".dev.vars");

const rl = createInterface({ input: process.stdin, output: process.stdout });

function run(cmd, cwd) {
  console.log(`\n$ ${cmd}`);
  return execSync(cmd, { cwd, stdio: ["inherit", "pipe", "inherit"], encoding: "utf-8" });
}

async function ask(question, fallback = "") {
  const suffix = fallback ? ` (${fallback})` : "";
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || fallback;
}

async function main() {
  console.log("=== School Harness セットアップ ===\n");

  console.log("--- 1. Cloudflareへのログイン確認 ---");
  try {
    run("npx wrangler whoami", apiDir);
  } catch {
    console.log("\nログインしていないようです。ブラウザが開くのでCloudflareアカウントでログインしてください。");
    run("npx wrangler login", apiDir);
  }

  console.log("\n--- 2. D1データベースの作成 ---");
  const dbName = await ask("D1データベース名", "school-harness");
  let databaseId = "";
  try {
    const output = run(`npx wrangler d1 create ${dbName}`, apiDir);
    console.log(output);
    const match = output.match(/database_id\s*=\s*"([0-9a-f-]+)"/i);
    if (match) databaseId = match[1];
  } catch {
    console.log(
      "\n作成に失敗しました。同名のデータベースが既に存在する場合は、`npx wrangler d1 list` で確認し、"
    );
    console.log("apps/api/wrangler.toml の database_id を手動で書き換えてください。");
  }

  if (databaseId) {
    let toml = readFileSync(wranglerTomlPath, "utf-8");
    toml = toml.replace(/database_id = ".*"/, `database_id = "${databaseId}"`);
    writeFileSync(wranglerTomlPath, toml);
    console.log(`\napps/api/wrangler.toml の database_id を更新しました: ${databaseId}`);
  }

  console.log("\n--- 3. LINE Messaging API / LINE Login の設定 ---");
  console.log("LINE Developersコンソール(https://developers.line.biz/)で発行した値を入力してください。");
  console.log("まだ準備していない場合は空欄のままEnterで進み、後からもう一度このスクリプトを実行できます。\n");
  const channelAccessToken = await ask("LINE_CHANNEL_ACCESS_TOKEN");
  const channelSecret = await ask("LINE_CHANNEL_SECRET");
  const liffChannelId = await ask("LIFF_CHANNEL_ID(LINE Loginチャネルの Channel ID)");

  if (channelAccessToken || channelSecret) {
    const devVars = [
      `LINE_CHANNEL_ACCESS_TOKEN=${channelAccessToken}`,
      `LINE_CHANNEL_SECRET=${channelSecret}`,
      "",
    ].join("\n");
    writeFileSync(devVarsPath, devVars);
    console.log(`\n${devVarsPath} を作成しました。`);
    console.log("本番環境では平文ファイルではなく `wrangler secret put LINE_CHANNEL_ACCESS_TOKEN` 等で設定してください。");
  }

  if (liffChannelId) {
    let toml = readFileSync(wranglerTomlPath, "utf-8");
    toml = toml.replace(/LIFF_CHANNEL_ID = ".*"/, `LIFF_CHANNEL_ID = "${liffChannelId}"`);
    writeFileSync(wranglerTomlPath, toml);
  }

  console.log("\n--- 4. ローカルD1へのマイグレーション適用 ---");
  run(`npx wrangler d1 migrations apply ${dbName} --local`, apiDir);

  console.log("\n=== セットアップ完了 ===");
  console.log("次のコマンドで開発サーバーを起動できます(それぞれ別ターミナルで):");
  console.log("  pnpm dev:api      # API   http://localhost:8787");
  console.log("  pnpm dev:admin    # 管理画面 http://localhost:3000");
  console.log("  pnpm dev:liff     # LIFF  http://localhost:3001");
  console.log("\n管理画面の http://localhost:3000/setup から、最初のオーナーアカウント(APIキー)を作成してください。");

  rl.close();
}

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
