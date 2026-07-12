import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, Variables } from "./types";
import setup from "./routes/setup";
import demo from "./routes/demo";
import dashboard from "./routes/dashboard";
import staffRoutes from "./routes/staff";
import students from "./routes/students";
import guardians from "./routes/guardians";
import classes from "./routes/classes";
import absences from "./routes/absences";
import attendance from "./routes/attendance";
import settings from "./routes/settings";
import reportTemplates from "./routes/report-templates";
import reports from "./routes/reports";
import announcements, { sendAnnouncementNow } from "./routes/announcements";
import invoices from "./routes/invoices";
import trials from "./routes/trials";
import grades from "./routes/grades";
import shifts from "./routes/shifts";
import referrals from "./routes/referrals";
import { promoteGradesIfDue } from "./lib/grade-promotion";
import lineWebhook from "./routes/line-webhook";
import liff from "./routes/liff";
import kiosk from "./routes/kiosk";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// 管理画面(Pages)・LIFFはAPIと別オリジンで動くためCORSが必須。
// 認証はヘッダー(X-API-Key / Authorization)のみでCookieを使わないため、
// 既定では全オリジンを許可し、ALLOWED_ORIGINSで自ドメインに絞り込める。
app.use("*", async (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS ?? "*").split(",").map((s) => s.trim());
  const handler = cors({
    origin: (origin) =>
      allowed.includes("*") || allowed.includes(origin) ? origin : null,
    allowHeaders: ["Content-Type", "X-API-Key", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });
  return handler(c, next);
});

app.get("/", (c) =>
  c.json({
    name: "School Harness API",
    status: "ok",
  })
);

app.get("/health", async (c) => {
  const db = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({
    status: db?.ok === 1 ? "ok" : "db_unreachable",
    timestamp: new Date().toISOString(),
  });
});

// 体験用デモ環境の初期化(DEMO_MODE=true のときのみ有効、APIキー不要)
app.route("/api/demo", demo);

// 管理画面向けAPI(要 X-API-Key)
app.route("/api/setup", setup);
app.route("/api/dashboard", dashboard);
app.route("/api/staff", staffRoutes);
app.route("/api/students", students);
app.route("/api/guardians", guardians);
app.route("/api/classes", classes);
app.route("/api/absences", absences);
app.route("/api/attendance", attendance);
app.route("/api/settings", settings);
app.route("/api/report-templates", reportTemplates);
app.route("/api/reports", reports);
app.route("/api/announcements", announcements);
app.route("/api/invoices", invoices);
app.route("/api/trials", trials);
app.route("/api/grades", grades);
app.route("/api/shifts", shifts);
app.route("/api/referrals", referrals);

// LINE Messaging API Webhook(署名検証あり、APIキー不要)
app.route("/line", lineWebhook);

// 保護者向けLIFF API(LINE IDトークンで認証、APIキー不要)
app.route("/liff", liff);

// 教室のタブレット/PC向けQRチェックイン(物理的な所持が認証代わり、APIキー不要)
app.route("/kiosk", kiosk);

async function scheduled(_event: ScheduledController, env: Env): Promise<void> {
  // 予約配信(scheduled_at到達済み・未送信)のお知らせを送信する
  // scheduled_at はISO 8601形式で保存されるため、datetime()でSQLiteの
  // 標準形式に正規化してから比較する(文字列形式の混在比較を避ける)
  const { results } = await env.DB.prepare(
    `SELECT * FROM announcements
     WHERE sent_at IS NULL AND scheduled_at IS NOT NULL AND datetime(scheduled_at) <= datetime('now')`
  ).all<{ id: string; title: string; body: string; segment: string; sent_at: string | null }>();

  for (const row of results ?? []) {
    await sendAnnouncementNow(env, row);
  }

  // 年に一度(日本時間4月1日)、在籍生徒の学年を自動で1つ上げる。
  // 進級処理の失敗が配信処理に影響しないよう、独立して try/catch する。
  try {
    await promoteGradesIfDue(env);
  } catch (err) {
    console.error("grade promotion failed", err);
  }
}

export default {
  fetch: app.fetch,
  scheduled,
};
