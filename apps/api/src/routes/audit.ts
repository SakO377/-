import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAuth, requireRole } from "../middleware/auth";

const audit = new Hono<{ Bindings: Env; Variables: Variables }>();
audit.use("*", requireAuth);
audit.use("*", requireRole("owner"));

audit.get("/", async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? "100"), 1), 300);
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?"
  )
    .bind(limit)
    .all();
  return c.json({ logs: results ?? [] });
});

export default audit;
