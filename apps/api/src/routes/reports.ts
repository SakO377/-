import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { generateId } from "../lib/id";
import { notifyGuardiansOfStudent } from "../lib/notify";

const reports = new Hono<{ Bindings: Env; Variables: Variables }>();
reports.use("*", requireAuth);

reports.get("/", async (c) => {
  const studentId = c.req.query("student_id");
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (studentId) {
    conditions.push("r.student_id = ?");
    params.push(studentId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { results } = await c.env.DB.prepare(
    `SELECT r.*, s.name AS student_name FROM reports r
     JOIN students s ON s.id = r.student_id
     ${where}
     ORDER BY r.created_at DESC`
  )
    .bind(...params)
    .all();
  return c.json({ reports: results ?? [] });
});

const reportInput = z.object({
  student_id: z.string().min(1),
  template_id: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  body: z.string().min(1),
});

reports.post("/", zValidator("json", reportInput), async (c) => {
  const body = c.req.valid("json");
  const id = generateId("report");
  await c.env.DB.prepare(
    "INSERT INTO reports (id, student_id, author, template_id, body) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(id, body.student_id, body.author ?? null, body.template_id ?? null, body.body)
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM reports WHERE id = ?").bind(id).first();
  return c.json(row, 201);
});

reports.get("/:id", async (c) => {
  const row = await c.env.DB.prepare("SELECT * FROM reports WHERE id = ?")
    .bind(c.req.param("id"))
    .first();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

reports.post("/:id/send", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT * FROM reports WHERE id = ?").bind(id).first<{
    id: string;
    student_id: string;
    sent_at: string | null;
  }>();
  if (!row) return c.json({ error: "Not found" }, 404);
  if (row.sent_at) return c.json({ error: "既に送信済みです" }, 409);

  const student = await c.env.DB.prepare("SELECT name FROM students WHERE id = ?")
    .bind(row.student_id)
    .first<{ name: string }>();
  const result = await notifyGuardiansOfStudent(c.env, row.student_id, "report", () => [
    { type: "text", text: `${student?.name ?? ""}さんの指導報告書が届きました。アプリでご確認ください。` },
  ]);

  if (result.sent > 0 || result.attempted === 0) {
    await c.env.DB.prepare("UPDATE reports SET sent_at = datetime('now') WHERE id = ?").bind(id).run();
  }

  return c.json({ send_result: result });
});

export default reports;
