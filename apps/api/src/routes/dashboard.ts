import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { getMonthlyPushCount } from "../lib/notify";

const dashboard = new Hono<{ Bindings: Env; Variables: Variables }>();
dashboard.use("*", requireAuth);

// 管理画面トップに表示する「今日の状況」の集計
dashboard.get("/", async (c) => {
  const db = c.env.DB;

  const [
    activeStudents,
    attendanceToday,
    pendingAbsences,
    unsentReports,
    scheduledAnnouncements,
    unpaidInvoices,
  ] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM students WHERE status = '在籍'").first<{
      count: number;
    }>(),
    db
      .prepare(
        `SELECT
           SUM(CASE WHEN type = 'check_in' THEN 1 ELSE 0 END) AS check_in,
           SUM(CASE WHEN type = 'check_out' THEN 1 ELSE 0 END) AS check_out
         FROM attendance_logs WHERE date(timestamp) = date('now')`
      )
      .first<{ check_in: number | null; check_out: number | null }>(),
    db.prepare("SELECT COUNT(*) AS count FROM absence_requests WHERE status != '確定'").first<{
      count: number;
    }>(),
    db.prepare("SELECT COUNT(*) AS count FROM reports WHERE sent_at IS NULL").first<{
      count: number;
    }>(),
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM announcements WHERE sent_at IS NULL AND scheduled_at IS NOT NULL"
      )
      .first<{ count: number }>(),
    db
      .prepare(
        "SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total FROM invoices WHERE paid_status != '入金済'"
      )
      .first<{ count: number; total: number }>(),
  ]);

  const quota = Number(c.env.LINE_FREE_PUSH_QUOTA || "200");
  const used = await getMonthlyPushCount(c.env);

  return c.json({
    students: { active: activeStudents?.count ?? 0 },
    attendance_today: {
      check_in: attendanceToday?.check_in ?? 0,
      check_out: attendanceToday?.check_out ?? 0,
    },
    absences_pending: pendingAbsences?.count ?? 0,
    reports_unsent: unsentReports?.count ?? 0,
    announcements_scheduled: scheduledAnnouncements?.count ?? 0,
    invoices_unpaid: {
      count: unpaidInvoices?.count ?? 0,
      total: unpaidInvoices?.total ?? 0,
    },
    line_quota: { used, quota, remaining: Math.max(quota - used, 0) },
  });
});

export default dashboard;
