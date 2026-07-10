import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { generateId, generateInviteCode, generateQrToken } from "../lib/id";
import { parseJsonArray, parseJsonObject } from "../lib/json";

const students = new Hono<{ Bindings: Env; Variables: Variables }>();
students.use("*", requireAuth);

const studentInput = z.object({
  name: z.string().min(1),
  grade: z.string().nullable().optional(),
  course: z.string().nullable().optional(),
  class_id: z.string().nullable().optional(),
  status: z.enum(["在籍", "休会", "退会"]).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  monthly_fee: z.number().int().nonnegative().nullable().optional(),
});

// D1の行(rawなJSON文字列カラムを含む)をAPIレスポンス用に整形する
function serializeStudentRow(row: Record<string, unknown>) {
  return {
    ...row,
    tags: parseJsonArray(row.tags as string | null),
    metadata: parseJsonObject(row.metadata as string | null),
  };
}

students.get("/", async (c) => {
  const status = c.req.query("status");
  const classId = c.req.query("class_id");
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (classId) {
    conditions.push("class_id = ?");
    params.push(classId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  // qr_token は入退室QRの秘密情報なので一覧では返さない
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, grade, course, class_id, status, tags, metadata, monthly_fee, created_at
     FROM students ${where} ORDER BY created_at DESC`
  )
    .bind(...params)
    .all();
  return c.json({ students: (results ?? []).map(serializeStudentRow) });
});

students.post("/", zValidator("json", studentInput), async (c) => {
  const body = c.req.valid("json");
  const id = generateId("student");
  const qrToken = generateQrToken();
  await c.env.DB.prepare(
    `INSERT INTO students (id, name, grade, course, class_id, status, tags, metadata, qr_token, monthly_fee)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.name,
      body.grade ?? null,
      body.course ?? null,
      body.class_id ?? null,
      body.status ?? "在籍",
      JSON.stringify(body.tags ?? []),
      JSON.stringify(body.metadata ?? {}),
      qrToken,
      body.monthly_fee ?? null
    )
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM students WHERE id = ?").bind(id).first();
  return c.json(serializeStudentRow(row as Record<string, unknown>), 201);
});

students.get("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT * FROM students WHERE id = ?").bind(id).first();
  if (!row) return c.json({ error: "Not found" }, 404);
  const { results: guardianRows } = await c.env.DB.prepare(
    `SELECT g.id, g.line_user_id, g.name, g.push_notifications_enabled, sg.relation
     FROM guardians g
     JOIN student_guardians sg ON sg.guardian_id = g.id
     WHERE sg.student_id = ?`
  )
    .bind(id)
    .all();
  return c.json({
    ...serializeStudentRow(row as Record<string, unknown>),
    guardians: guardianRows ?? [],
  });
});

students.patch("/:id", zValidator("json", studentInput.partial()), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const existing = await c.env.DB.prepare("SELECT id FROM students WHERE id = ?").bind(id).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const fields: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) {
    fields.push("name = ?");
    params.push(body.name);
  }
  if (body.grade !== undefined) {
    fields.push("grade = ?");
    params.push(body.grade);
  }
  if (body.course !== undefined) {
    fields.push("course = ?");
    params.push(body.course);
  }
  if (body.class_id !== undefined) {
    fields.push("class_id = ?");
    params.push(body.class_id);
  }
  if (body.status !== undefined) {
    fields.push("status = ?");
    params.push(body.status);
  }
  if (body.tags !== undefined) {
    fields.push("tags = ?");
    params.push(JSON.stringify(body.tags));
  }
  if (body.metadata !== undefined) {
    fields.push("metadata = ?");
    params.push(JSON.stringify(body.metadata));
  }
  if (body.monthly_fee !== undefined) {
    fields.push("monthly_fee = ?");
    params.push(body.monthly_fee);
  }
  if (fields.length > 0) {
    params.push(id);
    await c.env.DB.prepare(`UPDATE students SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
  }
  const row = await c.env.DB.prepare("SELECT * FROM students WHERE id = ?").bind(id).first();
  return c.json(serializeStudentRow(row as Record<string, unknown>));
});

students.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM students WHERE id = ?").bind(id).run();
  return c.body(null, 204);
});

students.post(
  "/:id/guardians",
  zValidator(
    "json",
    z.object({ guardian_id: z.string().min(1), relation: z.string().nullable().optional() })
  ),
  async (c) => {
    const studentId = c.req.param("id");
    const { guardian_id, relation } = c.req.valid("json");
    await c.env.DB.prepare(
      "INSERT OR REPLACE INTO student_guardians (student_id, guardian_id, relation) VALUES (?, ?, ?)"
    )
      .bind(studentId, guardian_id, relation ?? null)
      .run();
    return c.json({ student_id: studentId, guardian_id, relation: relation ?? null }, 201);
  }
);

students.delete("/:id/guardians/:guardianId", async (c) => {
  const studentId = c.req.param("id");
  const guardianId = c.req.param("guardianId");
  await c.env.DB.prepare(
    "DELETE FROM student_guardians WHERE student_id = ? AND guardian_id = ?"
  )
    .bind(studentId, guardianId)
    .run();
  return c.body(null, 204);
});

// 保護者のLINE連携用の招待コードを発行する(有効期限7日)
students.post("/:id/invite-codes", async (c) => {
  const studentId = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT id FROM students WHERE id = ?")
    .bind(studentId)
    .first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const id = generateId("invite");
  const code = generateInviteCode();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await c.env.DB.prepare(
    "INSERT INTO invite_codes (id, code, student_id, expires_at) VALUES (?, ?, ?, ?)"
  )
    .bind(id, code, studentId, expiresAt)
    .run();

  return c.json({ code, expires_at: expiresAt }, 201);
});

// 入退室QRの再発行(印刷物の紛失時など)
students.post("/:id/qr-token", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT id FROM students WHERE id = ?").bind(id).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const qrToken = generateQrToken();
  await c.env.DB.prepare("UPDATE students SET qr_token = ? WHERE id = ?").bind(qrToken, id).run();
  return c.json({ qr_token: qrToken });
});

export default students;
