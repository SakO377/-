import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { getMonthlyPushCount, getSetting, setSetting } from "../lib/notify";

const settings = new Hono<{ Bindings: Env; Variables: Variables }>();
settings.use("*", requireAuth);

// 振込先口座の設定キー
const BANK_KEYS = [
  "bank_name",
  "bank_branch",
  "bank_account_type",
  "bank_account_number",
  "bank_account_holder",
  "payment_note",
] as const;

async function buildStatus(env: Env) {
  const attendancePushEnabled = (await getSetting(env, "attendance_push_enabled", "1")) === "1";
  const inquiryAutoReplyEnabled = (await getSetting(env, "inquiry_auto_reply_enabled", "0")) === "1";
  const inquiryAutoReplyText = await getSetting(env, "inquiry_auto_reply_text", "");
  const enrollmentGuideText = await getSetting(env, "enrollment_guide_text", "");
  const bank: Record<string, string> = {};
  for (const k of BANK_KEYS) bank[k] = await getSetting(env, k, "");
  const used = await getMonthlyPushCount(env);
  const quota = Number(env.LINE_FREE_PUSH_QUOTA || "200");
  return {
    attendance_push_enabled: attendancePushEnabled,
    inquiry_auto_reply_enabled: inquiryAutoReplyEnabled,
    inquiry_auto_reply_text: inquiryAutoReplyText,
    enrollment_guide_text: enrollmentGuideText,
    bank_transfer: bank,
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
      bank_transfer: z
        .object({
          bank_name: z.string().optional(),
          bank_branch: z.string().optional(),
          bank_account_type: z.string().optional(),
          bank_account_number: z.string().optional(),
          bank_account_holder: z.string().optional(),
          payment_note: z.string().optional(),
        })
        .optional(),
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
    if (body.bank_transfer) {
      for (const k of BANK_KEYS) {
        const v = body.bank_transfer[k];
        if (v !== undefined) await setSetting(c.env, k, v);
      }
    }
    return c.json(await buildStatus(c.env));
  }
);

export default settings;
