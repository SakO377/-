import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { generateId } from "../lib/id";

const reportTemplates = new Hono<{ Bindings: Env; Variables: Variables }>();
reportTemplates.use("*", requireAuth);

const templateInput = z.object({
  name: z.string().min(1),
  subject: z.string().nullable().optional(),
  body_template: z.string().min(1),
});

reportTemplates.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM report_templates ORDER BY created_at DESC"
  ).all();
  return c.json({ report_templates: results ?? [] });
});

reportTemplates.post("/", zValidator("json", templateInput), async (c) => {
  const body = c.req.valid("json");
  const id = generateId("template");
  await c.env.DB.prepare(
    "INSERT INTO report_templates (id, name, subject, body_template) VALUES (?, ?, ?, ?)"
  )
    .bind(id, body.name, body.subject ?? null, body.body_template)
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM report_templates WHERE id = ?").bind(id).first();
  return c.json(row, 201);
});

reportTemplates.delete("/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM report_templates WHERE id = ?").bind(c.req.param("id")).run();
  return c.body(null, 204);
});

export default reportTemplates;
