import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { generateId } from "../lib/id";

const trials = new Hono<{ Bindings: Env; Variables: Variables }>();

const STATUSES = ["問い合わせ", "予約確定", "体験実施", "入会", "見送り"] as const;

// 公開フォームからの体験・見学の申込(APIキー不要)。誰でも送信できるので
// 作成のみ許可し、一覧・更新は管理者専用にする。
const publicInput = z.object({
  student_name: z.string().min(1).max(100),
  guardian_name: z.string().max(100).nullable().optional(),
  contact: z.string().max(200).nullable().optional(),
  desired_date: z.string().max(50).nullable().optional(),
  class_id: z.string().nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});

// クラスごとの占有状況(在籍＋予約確定の体験)と空き枠を計算する。
// capacity が未設定のクラスは remaining = null(制限なし)。
async function classAvailability(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.name, c.weekday, c.start_time, c.end_time, c.capacity,
            (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status = '在籍') AS enrolled,
            (SELECT COUNT(*) FROM trials t WHERE t.class_id = c.id AND t.status = '予約確定') AS reserved
     FROM classes c
     ORDER BY c.weekday, c.start_time`
  ).all<{
    id: string;
    name: string;
    weekday: number;
    start_time: string;
    end_time: string;
    capacity: number | null;
    enrolled: number;
    reserved: number;
  }>();
  return (results ?? []).map((r) => ({
    ...r,
    remaining: r.capacity == null ? null : Math.max(r.capacity - r.enrolled - r.reserved, 0),
  }));
}

// 公開フォーム用: 体験を受け付けられるクラスと空き枠を返す(APIキー不要)。
trials.get("/public-classes", async (c) => {
  return c.json({ classes: await classAvailability(c.env) });
});

trials.post("/public", zValidator("json", publicInput), async (c) => {
  const body = c.req.valid("json");
  // クラス指定があり、そのクラスが満席なら受け付けない(枠押さえ)
  if (body.class_id) {
    const cls = (await classAvailability(c.env)).find((x) => x.id === body.class_id);
    if (cls && cls.remaining !== null && cls.remaining <= 0) {
      return c.json({ error: "選択されたクラスは満席です。別のクラスをお選びください。" }, 409);
    }
  }
  const id = generateId("trial");
  await c.env.DB.prepare(
    `INSERT INTO trials (id, student_name, guardian_name, contact, desired_date, class_id, note, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, '問い合わせ')`
  )
    .bind(
      id,
      body.student_name,
      body.guardian_name ?? null,
      body.contact ?? null,
      body.desired_date ?? null,
      body.class_id ?? null,
      body.note ?? null
    )
    .run();
  return c.json({ id, status: "受け付けました" }, 201);
});

// ---- ここから管理者専用 ----
trials.use("*", requireAuth);

trials.get("/", async (c) => {
  const status = c.req.query("status");
  const where = status ? "WHERE t.status = ?" : "";
  const stmt = c.env.DB.prepare(
    `SELECT t.*, c.name AS class_name FROM trials t
     LEFT JOIN classes c ON c.id = t.class_id
     ${where}
     ORDER BY t.created_at DESC`
  );
  const { results } = await (status ? stmt.bind(status) : stmt).all();
  return c.json({ trials: results ?? [] });
});

const manualInput = publicInput.extend({
  status: z.enum(STATUSES).optional(),
});

trials.post("/", zValidator("json", manualInput), async (c) => {
  const body = c.req.valid("json");
  const id = generateId("trial");
  await c.env.DB.prepare(
    `INSERT INTO trials (id, student_name, guardian_name, contact, desired_date, class_id, note, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.student_name,
      body.guardian_name ?? null,
      body.contact ?? null,
      body.desired_date ?? null,
      body.class_id ?? null,
      body.note ?? null,
      body.status ?? "問い合わせ"
    )
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM trials WHERE id = ?").bind(id).first();
  return c.json(row, 201);
});

const updateInput = z.object({
  status: z.enum(STATUSES).optional(),
  desired_date: z.string().nullable().optional(),
  class_id: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

trials.patch("/:id", zValidator("json", updateInput), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const existing = await c.env.DB.prepare("SELECT id FROM trials WHERE id = ?").bind(id).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const fields: string[] = [];
  const params: unknown[] = [];
  (["status", "desired_date", "class_id", "note"] as const).forEach((key) => {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(body[key]);
    }
  });
  if (fields.length > 0) {
    params.push(id);
    await c.env.DB.prepare(`UPDATE trials SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
  }
  const row = await c.env.DB.prepare("SELECT * FROM trials WHERE id = ?").bind(id).first();
  return c.json(row);
});

trials.delete("/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM trials WHERE id = ?").bind(c.req.param("id")).run();
  return c.body(null, 204);
});

export default trials;
