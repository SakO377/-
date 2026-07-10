import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "../types";
import { generateId } from "../lib/id";
import { getSetting, notifyGuardiansOfStudent } from "../lib/notify";

const kiosk = new Hono<{ Bindings: Env }>();

// 教室のタブレット/PCに置くQRリーダー画面から呼び出す。認証は不要
// (QRカード自体の物理的な所持が認証代わり)。同日内で入室/退室を自動判定する。
kiosk.post(
  "/checkin",
  zValidator("json", z.object({ qr_token: z.string().min(1) })),
  async (c) => {
    const { qr_token } = c.req.valid("json");
    const student = await c.env.DB.prepare("SELECT id, name FROM students WHERE qr_token = ?")
      .bind(qr_token)
      .first<{ id: string; name: string }>();
    if (!student) return c.json({ error: "QRコードが認識できませんでした" }, 404);

    const today = new Date().toISOString().slice(0, 10);
    const lastToday = await c.env.DB.prepare(
      `SELECT type FROM attendance_logs
       WHERE student_id = ? AND date(timestamp) = ?
       ORDER BY timestamp DESC LIMIT 1`
    )
      .bind(student.id, today)
      .first<{ type: string }>();

    const type = lastToday?.type === "check_in" ? "check_out" : "check_in";
    const logId = generateId("attendance");
    await c.env.DB.prepare("INSERT INTO attendance_logs (id, student_id, type) VALUES (?, ?, ?)")
      .bind(logId, student.id, type)
      .run();

    const pushEnabled = (await getSetting(c.env, "attendance_push_enabled", "1")) === "1";
    let sent = 0;
    if (pushEnabled) {
      const label = type === "check_in" ? "入室" : "退室";
      const time = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
      const result = await notifyGuardiansOfStudent(c.env, student.id, "attendance", () => [
        { type: "text", text: `${student.name}さんが${label}しました。(${time})` },
      ]);
      sent = result.sent;
      if (sent > 0) {
        await c.env.DB.prepare("UPDATE attendance_logs SET notified_at = datetime('now') WHERE id = ?")
          .bind(logId)
          .run();
      }
    }

    return c.json({
      student_id: student.id,
      student_name: student.name,
      type,
      notified: sent > 0,
    });
  }
);

export default kiosk;
