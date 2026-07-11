import { Hono } from "hono";
import type { Env } from "../types";
import { seedDemoData } from "../lib/demo-seed";

const demo = new Hono<{ Bindings: Env }>();

// DEMO_MODE=true のときだけ有効。ボタン一つで体験を始められるように、
// デモ用オーナーと見本データを用意し、そのAPIキーを返す。
// 既にデータがある場合は、最初に発行されたデモ用オーナーのキーは再表示できないため、
// 「デモは初期化済み」であることだけを伝える(実運用では使わない前提の割り切り)。
demo.post("/session", async (c) => {
  if (c.env.DEMO_MODE !== "true") {
    return c.json({ error: "デモモードは無効です" }, 403);
  }

  const existing = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM staff").first<{
    count: number;
  }>();

  if ((existing?.count ?? 0) > 0) {
    return c.json(
      {
        error: "already_seeded",
        message:
          "このデモ環境は既に初期化されています。管理者から共有されたデモ用APIキーでログインしてください。",
      },
      409
    );
  }

  const apiKey = await seedDemoData(c.env);
  return c.json({ api_key: apiKey }, 201);
});

demo.get("/status", (c) => c.json({ enabled: c.env.DEMO_MODE === "true" }));

export default demo;
