import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";

const guardians = new Hono<{ Bindings: Env; Variables: Variables }>();
guardians.use("*", requireAuth);

function normalizeGuardian(row: Record<string, unknown>) {
  return { ...row, push_notifications_enabled: !!row.push_notifications_enabled };
}

guardians.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM guardians ORDER BY created_at DESC"
  ).all();
  return c.json({ guardians: (results ?? []).map(normalizeGuardian) });
});

guardians.get("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT * FROM guardians WHERE id = ?").bind(id).first();
  if (!row) return c.json({ error: "Not found" }, 404);
  const { results: studentRows } = await c.env.DB.prepare(
    `SELECT s.id, s.name, s.grade, s.course, s.status, sg.relation
     FROM students s
     JOIN student_guardians sg ON sg.student_id = s.id
     WHERE sg.guardian_id = ?`
  )
    .bind(id)
    .all();
  return c.json({ ...normalizeGuardian(row as Record<string, unknown>), students: studentRows ?? [] });
});

const guardianUpdate = z.object({
  name: z.string().nullable().optional(),
  push_notifications_enabled: z.boolean().optional(),
});

guardians.patch("/:id", zValidator("json", guardianUpdate), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const existing = await c.env.DB.prepare("SELECT id FROM guardians WHERE id = ?").bind(id).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const fields: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) {
    fields.push("name = ?");
    params.push(body.name);
  }
  if (body.push_notifications_enabled !== undefined) {
    fields.push("push_notifications_enabled = ?");
    params.push(body.push_notifications_enabled ? 1 : 0);
  }
  if (fields.length > 0) {
    params.push(id);
    await c.env.DB.prepare(`UPDATE guardians SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
  }
  const row = await c.env.DB.prepare("SELECT * FROM guardians WHERE id = ?").bind(id).first();
  return c.json(normalizeGuardian(row as Record<string, unknown>));
});

guardians.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM guardians WHERE id = ?").bind(id).run();
  return c.body(null, 204);
});

export default guardians;
