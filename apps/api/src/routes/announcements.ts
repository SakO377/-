import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { generateId } from "../lib/id";
import { parseJsonObject } from "../lib/json";
import { getMonthlyPushCount } from "../lib/notify";
import { pushMessage } from "../lib/line";
import { resolveSegmentGuardians, type Segment } from "../lib/segments";

const announcements = new Hono<{ Bindings: Env; Variables: Variables }>();
announcements.use("*", requireAuth);

const segmentSchema = z.object({
  type: z.enum(["all", "class", "tag"]),
  class_id: z.string().optional(),
  tag: z.string().optional(),
});

const announcementInput = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  segment: segmentSchema,
  scheduled_at: z.string().nullable().optional(),
});

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  segment: string;
  sent_at: string | null;
}

// 対象保護者へPush配信し、送信済みにマークする。無料枠が不足する場合は送信をスキップする
// (予約配信の場合は次回のcron実行時に再試行される)。
export async function sendAnnouncementNow(env: Env, announcement: AnnouncementRow) {
  const segment = parseJsonObject(announcement.segment) as unknown as Segment;
  const guardians = await resolveSegmentGuardians(env, segment);
  const eligible = guardians.filter((g) => g.push_notifications_enabled && g.line_user_id);

  if (eligible.length === 0) {
    await env.DB.prepare("UPDATE announcements SET sent_at = datetime('now') WHERE id = ?")
      .bind(announcement.id)
      .run();
    return { attempted: 0, sent: 0, skippedQuota: false };
  }

  const quota = Number(env.LINE_FREE_PUSH_QUOTA || "200");
  const used = await getMonthlyPushCount(env);
  if (quota - used < eligible.length) {
    return { attempted: eligible.length, sent: 0, skippedQuota: true };
  }

  let sent = 0;
  for (const g of eligible) {
    const res = await pushMessage(env.LINE_CHANNEL_ACCESS_TOKEN, g.line_user_id as string, [
      { type: "text", text: `【お知らせ】${announcement.title}\n${announcement.body}` },
    ]);
    if (res.ok) {
      sent += 1;
      await env.DB.prepare(
        "INSERT INTO line_message_log (id, message_type, purpose, recipient_count) VALUES (?, 'push', 'announcement', 1)"
      )
        .bind(generateId("msg"))
        .run();
    }
  }
  await env.DB.prepare("UPDATE announcements SET sent_at = datetime('now') WHERE id = ?")
    .bind(announcement.id)
    .run();
  return { attempted: eligible.length, sent, skippedQuota: false };
}

announcements.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM announcements ORDER BY created_at DESC"
  ).all<Record<string, unknown>>();
  return c.json({
    announcements: (results ?? []).map((r) => ({ ...r, segment: parseJsonObject(r.segment as string) })),
  });
});

announcements.post("/", zValidator("json", announcementInput), async (c) => {
  const body = c.req.valid("json");
  const id = generateId("announcement");
  await c.env.DB.prepare(
    "INSERT INTO announcements (id, title, body, segment, scheduled_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(id, body.title, body.body, JSON.stringify(body.segment), body.scheduled_at ?? null)
    .run();

  let sendResult = null;
  if (!body.scheduled_at) {
    sendResult = await sendAnnouncementNow(c.env, {
      id,
      title: body.title,
      body: body.body,
      segment: JSON.stringify(body.segment),
      sent_at: null,
    });
  }

  const row = await c.env.DB.prepare("SELECT * FROM announcements WHERE id = ?")
    .bind(id)
    .first<Record<string, unknown>>();
  return c.json(
    { ...row, segment: parseJsonObject(row!.segment as string), send_result: sendResult },
    201
  );
});

announcements.get("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT * FROM announcements WHERE id = ?")
    .bind(id)
    .first<Record<string, unknown>>();
  if (!row) return c.json({ error: "Not found" }, 404);
  const readCount = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM announcement_reads WHERE announcement_id = ?"
  )
    .bind(id)
    .first<{ count: number }>();
  return c.json({ ...row, segment: parseJsonObject(row.segment as string), read_count: readCount?.count ?? 0 });
});

announcements.post("/:id/send", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT * FROM announcements WHERE id = ?")
    .bind(id)
    .first<AnnouncementRow>();
  if (!row) return c.json({ error: "Not found" }, 404);
  if (row.sent_at) return c.json({ error: "既に送信済みです" }, 409);
  const result = await sendAnnouncementNow(c.env, row);
  return c.json({ send_result: result });
});

export default announcements;
