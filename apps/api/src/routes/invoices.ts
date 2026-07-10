import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { generateId } from "../lib/id";
import { parseJsonArray } from "../lib/json";
import { notifyGuardiansOfStudent } from "../lib/notify";
import { renderInvoiceHtml } from "../lib/invoice-html";

const invoices = new Hono<{ Bindings: Env; Variables: Variables }>();
invoices.use("*", requireAuth);

const itemSchema = z.object({ label: z.string().min(1), amount: z.number().int() });
const invoiceInput = z.object({
  student_id: z.string().min(1),
  year_month: z.string().regex(/^\d{4}-\d{2}$/),
  items: z.array(itemSchema).min(1),
});

function serializeInvoice(row: Record<string, unknown>) {
  return { ...row, items: parseJsonArray(row.items as string) };
}

invoices.get("/", async (c) => {
  const studentId = c.req.query("student_id");
  const yearMonth = c.req.query("year_month");
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (studentId) {
    conditions.push("i.student_id = ?");
    params.push(studentId);
  }
  if (yearMonth) {
    conditions.push("i.year_month = ?");
    params.push(yearMonth);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { results } = await c.env.DB.prepare(
    `SELECT i.*, s.name AS student_name FROM invoices i
     JOIN students s ON s.id = i.student_id
     ${where}
     ORDER BY i.year_month DESC, i.created_at DESC`
  )
    .bind(...params)
    .all<Record<string, unknown>>();
  return c.json({ invoices: (results ?? []).map(serializeInvoice) });
});

invoices.post("/", zValidator("json", invoiceInput), async (c) => {
  const body = c.req.valid("json");
  const total = body.items.reduce((sum, item) => sum + item.amount, 0);
  const id = generateId("invoice");
  await c.env.DB.prepare(
    "INSERT INTO invoices (id, student_id, year_month, items, total) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(id, body.student_id, body.year_month, JSON.stringify(body.items), total)
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM invoices WHERE id = ?")
    .bind(id)
    .first<Record<string, unknown>>();
  return c.json(serializeInvoice(row!), 201);
});

invoices.get("/:id", async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT i.*, s.name AS student_name FROM invoices i JOIN students s ON s.id = i.student_id WHERE i.id = ?`
  )
    .bind(c.req.param("id"))
    .first<Record<string, unknown>>();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(serializeInvoice(row));
});

const invoiceUpdate = z.object({
  items: z.array(itemSchema).min(1).optional(),
  paid_status: z.enum(["未入金", "入金済", "一部入金"]).optional(),
  paid_at: z.string().nullable().optional(),
});

invoices.patch("/:id", zValidator("json", invoiceUpdate), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const existing = await c.env.DB.prepare("SELECT id FROM invoices WHERE id = ?").bind(id).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const fields: string[] = [];
  const params: unknown[] = [];
  if (body.items !== undefined) {
    const total = body.items.reduce((sum, item) => sum + item.amount, 0);
    fields.push("items = ?", "total = ?");
    params.push(JSON.stringify(body.items), total);
  }
  if (body.paid_status !== undefined) {
    fields.push("paid_status = ?");
    params.push(body.paid_status);
  }
  if (body.paid_at !== undefined) {
    fields.push("paid_at = ?");
    params.push(body.paid_at);
  }
  if (fields.length > 0) {
    params.push(id);
    await c.env.DB.prepare(`UPDATE invoices SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
  }
  const row = await c.env.DB.prepare("SELECT * FROM invoices WHERE id = ?")
    .bind(id)
    .first<Record<string, unknown>>();
  return c.json(serializeInvoice(row!));
});

invoices.get("/:id/print", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT i.*, s.name AS student_name FROM invoices i JOIN students s ON s.id = i.student_id WHERE i.id = ?`
  )
    .bind(id)
    .first<{
      student_name: string;
      year_month: string;
      items: string;
      total: number;
      pdf_generated_at: string | null;
    }>();
  if (!row) return c.json({ error: "Not found" }, 404);

  if (!row.pdf_generated_at) {
    await c.env.DB.prepare("UPDATE invoices SET pdf_generated_at = datetime('now') WHERE id = ?")
      .bind(id)
      .run();
  }

  const html = renderInvoiceHtml({
    schoolName: "School Harness",
    studentName: row.student_name,
    yearMonth: row.year_month,
    items: parseJsonArray(row.items) as { label: string; amount: number }[],
    total: row.total,
    issuedAt: new Date().toLocaleDateString("ja-JP"),
  });
  return c.html(html);
});

invoices.post("/:id/send", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT * FROM invoices WHERE id = ?").bind(id).first<{
    id: string;
    student_id: string;
    year_month: string;
    sent_at: string | null;
  }>();
  if (!row) return c.json({ error: "Not found" }, 404);
  if (row.sent_at) return c.json({ error: "既に送信済みです" }, 409);

  const result = await notifyGuardiansOfStudent(c.env, row.student_id, "invoice", () => [
    {
      type: "text",
      text: `${row.year_month}分の請求書ができました。アプリでご確認・お支払いをお願いします。`,
    },
  ]);
  if (result.sent > 0 || result.attempted === 0) {
    await c.env.DB.prepare("UPDATE invoices SET sent_at = datetime('now') WHERE id = ?").bind(id).run();
  }
  return c.json({ send_result: result });
});

export default invoices;
