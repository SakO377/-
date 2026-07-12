import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { generateId } from "../lib/id";

const grades = new Hono<{ Bindings: Env; Variables: Variables }>();
grades.use("*", requireAuth);

grades.get("/", async (c) => {
  const studentId = c.req.query("student_id");
  const where = studentId ? "WHERE g.student_id = ?" : "";
  const stmt = c.env.DB.prepare(
    `SELECT g.*, s.name AS student_name FROM grades g
     JOIN students s ON s.id = g.student_id
     ${where}
     ORDER BY g.date DESC, g.created_at DESC`
  );
  const { results } = await (studentId ? stmt.bind(studentId) : stmt).all();
  return c.json({ grades: results ?? [] });
});

const gradeInput = z.object({
  student_id: z.string().min(1),
  subject: z.string().nullable().optional(),
  exam_name: z.string().min(1),
  date: z.string().nullable().optional(),
  score: z.number().int().nullable().optional(),
  max_score: z.number().int().positive().nullable().optional(),
  note: z.string().nullable().optional(),
});

grades.post("/", zValidator("json", gradeInput), async (c) => {
  const body = c.req.valid("json");
  const id = generateId("grade");
  await c.env.DB.prepare(
    `INSERT INTO grades (id, student_id, subject, exam_name, date, score, max_score, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.student_id,
      body.subject ?? null,
      body.exam_name,
      body.date ?? null,
      body.score ?? null,
      body.max_score ?? null,
      body.note ?? null
    )
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM grades WHERE id = ?").bind(id).first();
  return c.json(row, 201);
});

grades.delete("/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM grades WHERE id = ?").bind(c.req.param("id")).run();
  return c.body(null, 204);
});

export default grades;
