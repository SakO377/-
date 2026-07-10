import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";

const attendance = new Hono<{ Bindings: Env; Variables: Variables }>();
attendance.use("*", requireAuth);

attendance.get("/", async (c) => {
  const studentId = c.req.query("student_id");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (studentId) {
    conditions.push("a.student_id = ?");
    params.push(studentId);
  }
  if (from) {
    conditions.push("date(a.timestamp) >= ?");
    params.push(from);
  }
  if (to) {
    conditions.push("date(a.timestamp) <= ?");
    params.push(to);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { results } = await c.env.DB.prepare(
    `SELECT a.*, s.name AS student_name FROM attendance_logs a
     JOIN students s ON s.id = a.student_id
     ${where}
     ORDER BY a.timestamp DESC
     LIMIT 500`
  )
    .bind(...params)
    .all();
  return c.json({ attendance: results ?? [] });
});

attendance.get("/export.csv", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT a.timestamp, s.name AS student_name, a.type, a.notified_at
     FROM attendance_logs a JOIN students s ON s.id = a.student_id
     ORDER BY a.timestamp DESC LIMIT 5000`
  ).all<{ timestamp: string; student_name: string; type: string; notified_at: string | null }>();

  const header = "日時,生徒名,種別,通知";
  const rows = (results ?? []).map((r) =>
    [r.timestamp, r.student_name, r.type === "check_in" ? "入室" : "退室", r.notified_at ? "通知済み" : "未通知"]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [header, ...rows].join("\n");
  return c.body("﻿" + csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": "attachment; filename=attendance.csv",
  });
});

export default attendance;
