#!/usr/bin/env node
// 教室(テナント)環境の疎通確認スクリプト。
// 新規導入直後や、更新後の動作確認に使う。ネットにつながる普通のPCで実行できる。
//
// 使い方:
//   node scripts/check-tenant.mjs <slug>        # tenants/<slug>.json を読んでチェック
//   node scripts/check-tenant.mjs all           # tenants/ 内の全教室(example除く)
//
// 判定: ✅ 正常 / ⚠️ 注意(致命的ではない) / ❌ 異常。1つでも ❌ があれば終了コード1。

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tenantsDir = path.join(__dirname, "..", "tenants");

async function get(url, { json = false, timeout = 10000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    const body = json ? await res.json().catch(() => null) : null;
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, error: err.name === "AbortError" ? "タイムアウト" : err.message };
  } finally {
    clearTimeout(timer);
  }
}

function line(mark, label, detail) {
  console.log(`  ${mark} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function checkTenant(id) {
  const file = path.join(tenantsDir, `${id}.json`);
  if (!existsSync(file)) {
    console.log(`\n❌ tenants/${id}.json が見つかりません`);
    return false;
  }
  const t = JSON.parse(readFileSync(file, "utf-8"));
  console.log(`\n== ${t.classroom_name ?? id}(${id})==`);

  let hardFail = false;
  const fail = () => {
    hardFail = true;
  };

  // 1. API /health
  const health = await get(`${t.urls.api}/health`, { json: true });
  if (health.ok && health.body?.status === "ok") line("✅", "API /health", "ok");
  else {
    line("❌", "API /health", health.error ?? `status ${health.status} / ${JSON.stringify(health.body)}`);
    fail();
  }

  // 2. デモモード(本番は false であるべき)
  const demo = await get(`${t.urls.api}/api/demo/status`, { json: true });
  if (demo.ok && demo.body?.enabled === false) line("✅", "DEMO_MODE", "false(本番設定)");
  else if (demo.ok && demo.body?.enabled === true)
    line("⚠️", "DEMO_MODE", "true(誰でもデータ初期化可能。本番なら false にすること)");
  else {
    line("❌", "DEMO_MODE", demo.error ?? `status ${demo.status}`);
    fail();
  }

  // 3. DB到達確認(公開エンドポイント。認証不要でクラス一覧が返る=DB正常)
  const classes = await get(`${t.urls.api}/api/trials/public-classes`, { json: true });
  if (classes.ok && Array.isArray(classes.body?.classes))
    line("✅", "DB・API疎通(public-classes)", `${classes.body.classes.length} クラス`);
  else {
    line("❌", "DB・API疎通(public-classes)", classes.error ?? `status ${classes.status}`);
    fail();
  }

  // 4. 管理画面(Pages)
  const admin = await get(`${t.urls.admin}/login/`);
  if (admin.ok) line("✅", "管理画面", `${t.urls.admin}`);
  else {
    line("❌", "管理画面", admin.error ?? `status ${admin.status}`);
    fail();
  }

  // 5. 保護者LIFF(Pages)
  const liff = await get(`${t.urls.liff_direct}/`);
  if (liff.ok) line("✅", "保護者LIFF", `${t.urls.liff_direct}`);
  else {
    line("❌", "保護者LIFF", liff.error ?? `status ${liff.status}`);
    fail();
  }

  // 6. LINE設定状況(未設定は注意止まり。まだ連携前なら想定内)
  const liffId = t.line?.liff_id ?? "";
  if (!liffId || liffId.startsWith("REPLACE"))
    line("⚠️", "LINE連携設定", "未設定(公式アカウント・LIFF ID をまだ登録していません)");
  else line("✅", "LINE連携設定", `LIFF ID ${liffId}`);

  console.log(`  → ${hardFail ? "❌ 要対応の項目があります" : "✅ 主要な疎通は正常です"}`);
  return !hardFail;
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error("使い方: node scripts/check-tenant.mjs <slug | all>");
    process.exit(1);
  }
  let ids;
  if (target === "all") {
    ids = readdirSync(tenantsDir)
      .filter((f) => f.endsWith(".json") && f !== "example.json")
      .map((f) => f.replace(/\.json$/, ""));
    if (ids.length === 0) {
      console.error("tenants/ に対象がありません(example.json は対象外)。");
      process.exit(1);
    }
  } else {
    ids = [target];
  }

  let allOk = true;
  for (const id of ids) {
    const ok = await checkTenant(id);
    if (!ok) allOk = false;
  }
  console.log(`\n================\n${allOk ? "✅ すべて正常" : "❌ 異常のあるテナントがあります"}`);
  if (!allOk) process.exit(1);
}

main();
