import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { generateId } from "../lib/id";
import { notifyGuardiansOfStudent } from "../lib/notify";

const absences = new Hono<{ Bindings: Env; Variables: Variables }>();
absences.use("*", requireAuth);

absences.get("/", async (c) => {
  const status = c.req.query("status");
  const studentId = c.req.query("student_id");
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (status) {
    conditions.push("a.status = ?");
    params.push(status);
  }
  if (studentId) {
    conditions.push("a.student_id = ?");
    params.push(studentId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { results } = await c.env.DB.prepare(
    `SELECT a.*, s.name AS student_name, mc.name AS makeup_class_name FROM absence_requests a
     JOIN students s ON s.id = a.student_id
     LEFT JOIN classes mc ON mc.id = a.makeup_class_id
     ${where}
     ORDER BY a.date DESC, a.created_at DESC`
  )
    .bind(...params)
    .all();
  return c.json({ absences: results ?? [] });
});

const absenceInput = z.object({
  student_id: z.string().min(1),
  class_id: z.string().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().nullable().optional(),
});

// 管理画面からの手動登録(電話連絡の記録など)用
absences.post("/", zValidator("json", absenceInput), async (c) => {
  const body = c.req.valid("json");
  const id = generateId("absence");
  await c.env.DB.prepare(
    `INSERT INTO absence_requests (id, student_id, class_id, date, reason, status)
     VALUES (?, ?, ?, ?, ?, '申請')`
  )
    .bind(id, body.student_id, body.class_id ?? null, body.date, body.reason ?? null)
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM absence_requests WHERE id = ?").bind(id).first();
  return c.json(row, 201);
});

const absenceUpdate = z.object({
  status: z.enum(["申請", "振替提案", "確定", "欠席のみ"]).optional(),
  makeup_date: z.string().nullable().optional(),
});

absences.patch("/:id", zValidator("json", absenceUpdate), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const existing = await c.env.DB.prepare(
    "SELECT id, student_id, status FROM absence_requests WHERE id = ?"
  )
    .bind(id)
    .first<{ id: string; student_id: string; status: string }>();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const fields: string[] = [];
  const params: unknown[] = [];
  if (body.status !== undefined) {
    fields.push("status = ?");
    params.push(body.status);
  }
  if (body.makeup_date !== undefined) {
    fields.push("makeup_date = ?");
    params.push(body.makeup_date);
  }
  if (fields.length > 0) {
    params.push(id);
    await c.env.DB.prepare(`UPDATE absence_requests SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
  }

  // 教室側が振替日を提案・確定した場合は、保護者へLINEで知らせる
  // (これまでは通知が無く、保護者がアプリを自発的に開かない限り気づけなかった)。
  if (body.status === "振替提案" && body.status !== existing.status) {
    await notifyGuardiansOfStudent(c.env, existing.student_id, "absence_makeup_proposed", () => [
      {
        type: "text",
        text: `振替日をご提案しました${
          body.makeup_date ? `(候補日: ${body.makeup_date})` : ""
        }。アプリでご確認のうえ、確定または他の空き枠からお選びください。`,
      },
    ]);
  } else if (body.status === "確定" && body.status !== existing.status) {
    await notifyGuardiansOfStudent(c.env, existing.student_id, "absence_makeup_confirmed", () => [
      { type: "text", text: "振替日が確定しました。アプリでご確認ください。" },
    ]);
  }

  const row = await c.env.DB.prepare(
    `SELECT a.*, s.name AS student_name, mc.name AS makeup_class_name FROM absence_requests a
     JOIN students s ON s.id = a.student_id
     LEFT JOIN classes mc ON mc.id = a.makeup_class_id
     WHERE a.id = ?`
  )
    .bind(id)
    .first();
  return c.json(row);
});

export default absences;
