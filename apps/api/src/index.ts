import { Hono } from "hono";
import type { Env, Variables } from "./types";
import setup from "./routes/setup";
import students from "./routes/students";
import guardians from "./routes/guardians";
import classes from "./routes/classes";
import absences from "./routes/absences";
import attendance from "./routes/attendance";
import settings from "./routes/settings";
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

// LINE Messaging API Webhook(署名検証あり、APIキー不要)
app.route("/line", lineWebhook);

// 保護者向けLIFF API(LINE IDトークンで認証、APIキー不要)
app.route("/liff", liff);

// 教室のタブレット/PC向けQRチェックイン(物理的な所持が認証代わり、APIキー不要)
app.route("/kiosk", kiosk);

export default app;
