import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { generateId } from "../lib/id";

const referrals = new Hono<{ Bindings: Env; Variables: Variables }>();
referrals.use("*", requireAuth);

const STATUSES = ["紹介受付", "体験", "入会", "特典付与済", "見送り"] as const;

referrals.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT r.*, s.name AS referrer_student_name FROM referrals r
     LEFT JOIN students s ON s.id = r.referrer_student_id
     ORDER BY r.created_at DESC`
  ).all();
  return c.json({ referrals: results ?? [] });
});

const referralInput = z.object({
  referrer_student_id: z.string().nullable().optional(),
  referrer_name: z.string().nullable().optional(),
  referee_name: z.string().min(1),
  status: z.enum(STATUSES).optional(),
  reward_note: z.string().nullable().optional(),
});

referrals.post("/", zValidator("json", referralInput), async (c) => {
  const body = c.req.valid("json");
  const id = generateId("referral");
  await c.env.DB.prepare(
    `INSERT INTO referrals (id, referrer_student_id, referrer_name, referee_name, status, reward_note)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.referrer_student_id ?? null,
      body.referrer_name ?? null,
      body.referee_name,
      body.status ?? "紹介受付",
      body.reward_note ?? null
    )
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM referrals WHERE id = ?").bind(id).first();
  return c.json(row, 201);
});

const updateInput = z.object({
  status: z.enum(STATUSES).optional(),
  reward_note: z.string().nullable().optional(),
});

referrals.patch("/:id", zValidator("json", updateInput), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const existing = await c.env.DB.prepare("SELECT id FROM referrals WHERE id = ?").bind(id).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const fields: string[] = [];
  const params: unknown[] = [];
  (["status", "reward_note"] as const).forEach((key) => {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(body[key]);
    }
  });
  if (fields.length > 0) {
    params.push(id);
    await c.env.DB.prepare(`UPDATE referrals SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
  }
  const row = await c.env.DB.prepare("SELECT * FROM referrals WHERE id = ?").bind(id).first();
  return c.json(row);
});

referrals.delete("/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM referrals WHERE id = ?").bind(c.req.param("id")).run();
  return c.body(null, 204);
});

export default referrals;
