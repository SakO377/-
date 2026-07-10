import { Hono } from "hono";
import type { Env, Variables } from "./types";
import setup from "./routes/setup";
import students from "./routes/students";
import guardians from "./routes/guardians";
import classes from "./routes/classes";
import absences from "./routes/absences";
import attendance from "./routes/attendance";
import settings from "./routes/settings";
import reportTemplates from "./routes/report-templates";
import reports from "./routes/reports";
import announcements, { sendAnnouncementNow } from "./routes/announcements";
import lineWebhook from "./routes/line-webhook";
import liff from "./routes/liff";
import kiosk from "./routes/kiosk";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

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

// 管理画面向けAPI(要 X-API-Key)
app.route("/api/setup", setup);
app.route("/api/students", students);
app.route("/api/guardians", guardians);
app.route("/api/classes", classes);
app.route("/api/absences", absences);
app.route("/api/attendance", attendance);
app.route("/api/settings", settings);
app.route("/api/report-templates", reportTemplates);
app.route("/api/reports", reports);
app.route("/api/announcements", announcements);

// LINE Messaging API Webhook(署名検証あり、APIキー不要)
app.route("/line", lineWebhook);

// 保護者向けLIFF API(LINE IDトークンで認証、APIキー不要)
app.route("/liff", liff);

// 教室のタブレット/PC向けQRチェックイン(物理的な所持が認証代わり、APIキー不要)
app.route("/kiosk", kiosk);

async function scheduled(_event: ScheduledController, env: Env): Promise<void> {
  // 予約配信(scheduled_at到達済み・未送信)のお知らせを送信する
  const { results } = await env.DB.prepare(
    `SELECT * FROM announcements
     WHERE sent_at IS NULL AND scheduled_at IS NOT NULL AND scheduled_at <= datetime('now')`
  ).all<{ id: string; title: string; body: string; segment: string; sent_at: string | null }>();

  for (const row of results ?? []) {
    await sendAnnouncementNow(env, row);
  }
}

export default {
  fetch: app.fetch,
  scheduled,
};
