import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { generateId } from "../lib/id";

const shifts = new Hono<{ Bindings: Env; Variables: Variables }>();
shifts.use("*", requireAuth);

shifts.get("/", async (c) => {
  const from = c.req.query("from");
  const to = c.req.query("to");
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (from) {
    conditions.push("sh.date >= ?");
    params.push(from);
  }
  if (to) {
    conditions.push("sh.date <= ?");
    params.push(to);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { results } = await c.env.DB.prepare(
    `SELECT sh.*, st.name AS staff_name FROM shifts sh
     JOIN staff st ON st.id = sh.staff_id
     ${where}
     ORDER BY sh.date, sh.start_time`
  )
    .bind(...params)
    .all();
  return c.json({ shifts: results ?? [] });
});

const shiftInput = z.object({
  staff_id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  note: z.string().nullable().optional(),
});

shifts.post("/", zValidator("json", shiftInput), async (c) => {
  const body = c.req.valid("json");
  const id = generateId("shift");
  await c.env.DB.prepare(
    "INSERT INTO shifts (id, staff_id, date, start_time, end_time, note) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(id, body.staff_id, body.date, body.start_time, body.end_time, body.note ?? null)
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM shifts WHERE id = ?").bind(id).first();
  return c.json(row, 201);
});

shifts.delete("/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM shifts WHERE id = ?").bind(c.req.param("id")).run();
  return c.body(null, 204);
});

export default shifts;
