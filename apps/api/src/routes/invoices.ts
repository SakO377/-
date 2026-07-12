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

// 当月分の請求書を在籍生徒へ一括作成する。月謝(monthly_fee)が設定された生徒が対象で、
// その月の請求書が既にある生徒はスキップする(重複作成を防ぐ)。
invoices.post(
  "/bulk",
  zValidator("json", z.object({ year_month: z.string().regex(/^\d{4}-\d{2}$/) })),
  async (c) => {
    const { year_month } = c.req.valid("json");

    const { results: studentsRows } = await c.env.DB.prepare(
      "SELECT id, monthly_fee FROM students WHERE status = '在籍'"
    ).all<{ id: string; monthly_fee: number | null }>();

    const { results: existingRows } = await c.env.DB.prepare(
      "SELECT student_id FROM invoices WHERE year_month = ?"
    )
      .bind(year_month)
      .all<{ student_id: string }>();
    const existing = new Set((existingRows ?? []).map((r) => r.student_id));

    let created = 0;
    let skippedExisting = 0;
    let skippedNoFee = 0;
    const statements = [];
    for (const s of studentsRows ?? []) {
      if (existing.has(s.id)) {
        skippedExisting += 1;
        continue;
      }
      if (s.monthly_fee == null || s.monthly_fee <= 0) {
        skippedNoFee += 1;
        continue;
      }
      const items = JSON.stringify([{ label: "月謝", amount: s.monthly_fee }]);
      statements.push(
        c.env.DB.prepare(
          "INSERT INTO invoices (id, student_id, year_month, items, total) VALUES (?, ?, ?, ?, ?)"
        ).bind(generateId("invoice"), s.id, year_month, items, s.monthly_fee)
      );
      created += 1;
    }
    if (statements.length > 0) await c.env.DB.batch(statements);

    return c.json({ created, skipped_existing: skippedExisting, skipped_no_fee: skippedNoFee });
  }
);

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

// 未入金の請求書について、保護者へLINEで支払いリマインドを送る。
async function remindOne(
  env: Env,
  invoice: { id: string; student_id: string; year_month: string; total: number }
) {
  return notifyGuardiansOfStudent(env, invoice.student_id, "invoice_reminder", () => [
    {
      type: "text",
      text: `${invoice.year_month}分のお月謝(¥${invoice.total.toLocaleString(
        "ja-JP"
      )})のお支払いがまだのようです。ご確認をお願いいたします。`,
    },
  ]);
}

invoices.post("/:id/remind", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT * FROM invoices WHERE id = ?").bind(id).first<{
    id: string;
    student_id: string;
    year_month: string;
    total: number;
    paid_status: string;
  }>();
  if (!row) return c.json({ error: "Not found" }, 404);
  if (row.paid_status === "入金済") return c.json({ error: "既に入金済みです" }, 409);
  const result = await remindOne(c.env, row);
  return c.json({ send_result: result });
});

// 未入金・一部入金の全請求書へまとめて支払いリマインドを送る。
invoices.post("/remind-unpaid", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, student_id, year_month, total FROM invoices WHERE paid_status != '入金済'"
  ).all<{ id: string; student_id: string; year_month: string; total: number }>();

  let attempted = 0;
  let sent = 0;
  for (const row of results ?? []) {
    const r = await remindOne(c.env, row);
    attempted += r.attempted;
    sent += r.sent;
  }
  return c.json({ invoices: (results ?? []).length, attempted, sent });
});

export default invoices;
