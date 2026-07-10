import { Hono } from "hono";
import type { Env } from "../types";
import { verifyLineSignature, replyMessage } from "../lib/line";
import { generateId } from "../lib/id";

interface LineEvent {
  type: string;
  replyToken?: string;
  source: { userId?: string; type: string };
}

const lineWebhook = new Hono<{ Bindings: Env }>();

lineWebhook.post("/webhook", async (c) => {
  const signature = c.req.header("x-line-signature");
  const rawBody = await c.req.text();
  const valid = await verifyLineSignature(rawBody, signature ?? null, c.env.LINE_CHANNEL_SECRET);
  if (!valid) {
    return c.json({ error: "invalid signature" }, 401);
  }

  const body = JSON.parse(rawBody) as { events: LineEvent[] };

  for (const event of body.events) {
    // 友だち追加時: 招待コード入力を促す(応答メッセージ=Replyは無料枠を消費しない)
    if (event.type === "follow" && event.replyToken) {
      await replyMessage(c.env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, [
        {
          type: "text",
          text: "友だち追加ありがとうございます。教室から受け取った招待コードを使って、お子さまとの連携を行ってください。",
        },
      ]);
      await c.env.DB.prepare(
        "INSERT INTO line_message_log (id, message_type, purpose, recipient_count) VALUES (?, 'reply', 'follow_welcome', 1)"
      )
        .bind(generateId("msg"))
        .run();
    }
  }

  return c.json({ status: "ok" });
});

export default lineWebhook;
