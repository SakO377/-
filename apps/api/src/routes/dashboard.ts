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

// 直近nか月の「請求額(予定)」と「入金額(実績)」の推移。
// 予定=その月に発行した請求書の合計、実績=そのうち入金済みの合計。
// projected_monthly は在籍生徒の月謝合計(今後の毎月の見込み額)。
dashboard.get("/revenue", async (c) => {
  const db = c.env.DB;
  const months = Math.min(Math.max(Number(c.req.query("months") ?? "6"), 1), 24);

  const projected = await db
    .prepare("SELECT COALESCE(SUM(monthly_fee), 0) AS total FROM students WHERE status = '在籍'")
    .first<{ total: number }>();

  // 対象の年月リスト(古い順)を日本時間基準で生成する
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const yearMonths: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    yearMonths.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  const { results } = await db
    .prepare(
      `SELECT year_month,
              COALESCE(SUM(total), 0) AS invoiced,
              COALESCE(SUM(CASE WHEN paid_status = '入金済' THEN total ELSE 0 END), 0) AS paid
       FROM invoices
       WHERE year_month >= ?
       GROUP BY year_month`
    )
    .bind(yearMonths[0])
    .all<{ year_month: string; invoiced: number; paid: number }>();

  const byMonth = new Map((results ?? []).map((r) => [r.year_month, r]));
  const series = yearMonths.map((ym) => {
    const row = byMonth.get(ym);
    const invoiced = row?.invoiced ?? 0;
    const paid = row?.paid ?? 0;
    return { year_month: ym, invoiced, paid, difference: invoiced - paid };
  });

  return c.json({ projected_monthly: projected?.total ?? 0, months: series });
});

// 離脱リスクのある在籍生徒を検知する(継続率アラート)。
// ・長期未出席: 直近 absenceDays 日間に入室記録がない
// ・未入金滞留: 未入金/一部入金の請求書が unpaidDays 日以上前から残っている
// いずれも既存データのみで判定するため追加コストなし。
dashboard.get("/at-risk", async (c) => {
  const db = c.env.DB;
  const absenceDays = 21;
  const unpaidDays = 30;

  const { results } = await db
    .prepare(
      `SELECT s.id, s.name, s.grade,
              (SELECT MAX(timestamp) FROM attendance_logs al
                 WHERE al.student_id = s.id AND al.type = 'check_in') AS last_check_in,
              (SELECT COUNT(*) FROM invoices i
                 WHERE i.student_id = s.id AND i.paid_status != '入金済'
                   AND i.created_at <= datetime('now', ?)) AS overdue_unpaid
       FROM students s
       WHERE s.status = '在籍'
       ORDER BY s.created_at`
    )
    .bind(`-${unpaidDays} days`)
    .all<{
      id: string;
      name: string;
      grade: string | null;
      last_check_in: string | null;
      overdue_unpaid: number;
    }>();

  const cutoff = new Date(Date.now() - absenceDays * 24 * 60 * 60 * 1000);
  const atRisk: {
    id: string;
    name: string;
    grade: string | null;
    reasons: string[];
    last_check_in: string | null;
    overdue_unpaid: number;
  }[] = [];

  for (const s of results ?? []) {
    const reasons: string[] = [];
    // last_check_in は "YYYY-MM-DD HH:MM:SS"(UTC)。記録があり、かつ古い場合のみ対象。
    if (s.last_check_in) {
      const last = new Date(s.last_check_in.replace(" ", "T") + "Z");
      if (last < cutoff) {
        reasons.push(`${absenceDays}日以上入室なし`);
      }
    }
    if (s.overdue_unpaid > 0) {
      reasons.push(`未入金 ${s.overdue_unpaid} 件(${unpaidDays}日以上)`);
    }
    if (reasons.length > 0) {
      atRisk.push({
        id: s.id,
        name: s.name,
        grade: s.grade,
        reasons,
        last_check_in: s.last_check_in,
        overdue_unpaid: s.overdue_unpaid,
      });
    }
  }

  return c.json({ at_risk: atRisk, criteria: { absence_days: absenceDays, unpaid_days: unpaidDays } });
});

export default dashboard;
