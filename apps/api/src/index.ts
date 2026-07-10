import { Hono } from "hono";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) =>
  c.json({
    name: "School Harness API",
    status: "ok",
  })
);

app.get("/health", async (c) => {
  const db = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({
    status: db?.ok === 1 ? "ok" : "db_unreachable",
    timestamp: new Date().toISOString(),
  });
});

// 生徒 / 保護者 / クラス などの CRUD ルートは Step 2 で追加する。

export default app;
