import { Hono } from "hono";
import type { Env } from "../types";
import { verifyLineSignature, replyMessage, type LineMessage } from "../lib/line";
import { generateId } from "../lib/id";
import { getSetting } from "../lib/notify";

interface LineEvent {
  type: string;
  replyToken?: string;
  message?: { type: string; text?: string };
  source: { userId?: string; type: string };
}

async function logReply(env: Env, purpose: string) {
  await env.DB.prepare(
    "INSERT INTO line_message_log (id, message_type, purpose, recipient_count) VALUES (?, 'reply', ?, 1)"
  )
    .bind(generateId("msg"), purpose)
    .run();
}

// 招待コードは16桁の英数字。友だち追加済みの保護者が送ってきた場合に備え、
// メッセージが招待コードらしいときは自動応答を出さない(連携フローを邪魔しない)。
function looksLikeInviteCode(text: string): boolean {
  return /^[0-9A-Fa-f]{12}$/.test(text.trim());
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
    // 友だち追加時: 招待コード入力を促す(応答メッセージ=Replyは無料枠を消費しない)。
    // 入会案内文が設定されていれば続けて送る。
    if (event.type === "follow" && event.replyToken) {
      const messages: LineMessage[] = [
        {
          type: "text",
          text: "友だち追加ありがとうございます。教室から受け取った招待コードを使って、お子さまとの連携を行ってください。",
        },
      ];
      const guide = await getSetting(c.env, "enrollment_guide_text", "");
      if (guide.trim()) messages.push({ type: "text", text: guide });
      await replyMessage(c.env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, messages);
      await logReply(c.env, "follow_welcome");
    }

    // メッセージ受信時の一次自動応答(問い合わせへの初動)。
    // 招待コードの入力は連携フローのため対象外にする。
    if (event.type === "message" && event.replyToken && event.message?.type === "text") {
      const text = event.message.text ?? "";
      const enabled = (await getSetting(c.env, "inquiry_auto_reply_enabled", "0")) === "1";
      const replyText = await getSetting(c.env, "inquiry_auto_reply_text", "");
      if (enabled && replyText.trim() && !looksLikeInviteCode(text)) {
        await replyMessage(c.env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, [
          { type: "text", text: replyText },
        ]);
        await logReply(c.env, "inquiry_auto_reply");
      }
    }
  }

  return c.json({ status: "ok" });
});

export default lineWebhook;
