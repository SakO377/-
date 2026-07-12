import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { getMonthlyPushCount, getSetting, setSetting } from "../lib/notify";

const settings = new Hono<{ Bindings: Env; Variables: Variables }>();
settings.use("*", requireAuth);

async function buildStatus(env: Env) {
  const attendancePushEnabled = (await getSetting(env, "attendance_push_enabled", "1")) === "1";
  const inquiryAutoReplyEnabled = (await getSetting(env, "inquiry_auto_reply_enabled", "0")) === "1";
  const inquiryAutoReplyText = await getSetting(env, "inquiry_auto_reply_text", "");
  const enrollmentGuideText = await getSetting(env, "enrollment_guide_text", "");
  const used = await getMonthlyPushCount(env);
  const quota = Number(env.LINE_FREE_PUSH_QUOTA || "200");
  return {
    attendance_push_enabled: attendancePushEnabled,
    inquiry_auto_reply_enabled: inquiryAutoReplyEnabled,
    inquiry_auto_reply_text: inquiryAutoReplyText,
    enrollment_guide_text: enrollmentGuideText,
    line_quota: { used, quota, remaining: Math.max(quota - used, 0) },
  };
}

settings.get("/", async (c) => c.json(await buildStatus(c.env)));

settings.patch(
  "/",
  zValidator(
    "json",
    z.object({
      attendance_push_enabled: z.boolean().optional(),
      inquiry_auto_reply_enabled: z.boolean().optional(),
      inquiry_auto_reply_text: z.string().optional(),
      enrollment_guide_text: z.string().optional(),
    })
  ),
  async (c) => {
    const body = c.req.valid("json");
    if (body.attendance_push_enabled !== undefined) {
      await setSetting(c.env, "attendance_push_enabled", body.attendance_push_enabled ? "1" : "0");
    }
    if (body.inquiry_auto_reply_enabled !== undefined) {
      await setSetting(
        c.env,
        "inquiry_auto_reply_enabled",
        body.inquiry_auto_reply_enabled ? "1" : "0"
      );
    }
    if (body.inquiry_auto_reply_text !== undefined) {
      await setSetting(c.env, "inquiry_auto_reply_text", body.inquiry_auto_reply_text);
    }
    if (body.enrollment_guide_text !== undefined) {
      await setSetting(c.env, "enrollment_guide_text", body.enrollment_guide_text);
    }
    return c.json(await buildStatus(c.env));
  }
);

export default settings;
