import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { generateId } from "../lib/id";

const classes = new Hono<{ Bindings: Env; Variables: Variables }>();
classes.use("*", requireAuth);

const classInput = z.object({
  name: z.string().min(1),
  weekday: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  capacity: z.number().int().positive().nullable().optional(),
});

classes.get("/", async (c) => {
  // 既定は現役クラスのみ。?archived=1 で削除(アーカイブ)済みクラスを返す。
  const archived = c.req.query("archived") === "1";
  const where = archived ? "c.archived_at IS NOT NULL" : "c.archived_at IS NULL";
  // 在籍生徒数(enrolled)を同時に返し、定員に対する空き枠を管理画面で表示できるようにする
  const { results } = await c.env.DB.prepare(
    `SELECT c.*,
            (SELECT COUNT(*) FROM students s
              WHERE s.class_id = c.id AND s.status = '在籍') AS enrolled
     FROM classes c
     WHERE ${where}
     ORDER BY c.weekday, c.start_time`
  ).all();
  return c.json({ classes: results ?? [] });
});

classes.post("/", zValidator("json", classInput), async (c) => {
  const body = c.req.valid("json");
  const id = generateId("class");
  await c.env.DB.prepare(
    "INSERT INTO classes (id, name, weekday, start_time, end_time, capacity) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(id, body.name, body.weekday, body.start_time, body.end_time, body.capacity ?? null)
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM classes WHERE id = ?").bind(id).first();
  return c.json(row, 201);
});

classes.get("/:id", async (c) => {
  const row = await c.env.DB.prepare("SELECT * FROM classes WHERE id = ?")
    .bind(c.req.param("id"))
    .first();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

classes.patch("/:id", zValidator("json", classInput.partial()), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const existing = await c.env.DB.prepare("SELECT id FROM classes WHERE id = ?").bind(id).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const fields: string[] = [];
  const params: unknown[] = [];
  (["name", "weekday", "start_time", "end_time", "capacity"] as const).forEach((key) => {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(body[key]);
    }
  });
  if (fields.length > 0) {
    params.push(id);
    await c.env.DB.prepare(`UPDATE classes SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
  }
  const row = await c.env.DB.prepare("SELECT * FROM classes WHERE id = ?").bind(id).first();
  return c.json(row);
});

// 物理削除せずアーカイブする(削除記録として archived_at を残し、
// 在籍生徒のクラス参照や過去の欠席・振替記録を壊さない)。
classes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT id FROM classes WHERE id = ?").bind(id).first();
  if (!existing) return c.json({ error: "Not found" }, 404);
  await c.env.DB.prepare(
    "UPDATE classes SET archived_at = datetime('now') WHERE id = ? AND archived_at IS NULL"
  )
    .bind(id)
    .run();
  return c.body(null, 204);
});

export default classes;
