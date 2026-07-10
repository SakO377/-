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
  const used = await getMonthlyPushCount(env);
  const quota = Number(env.LINE_FREE_PUSH_QUOTA || "200");
  return {
    attendance_push_enabled: attendancePushEnabled,
    line_quota: { used, quota, remaining: Math.max(quota - used, 0) },
  };
}

settings.get("/", async (c) => c.json(await buildStatus(c.env)));

settings.patch(
  "/",
  zValidator("json", z.object({ attendance_push_enabled: z.boolean().optional() })),
  async (c) => {
    const body = c.req.valid("json");
    if (body.attendance_push_enabled !== undefined) {
      await setSetting(c.env, "attendance_push_enabled", body.attendance_push_enabled ? "1" : "0");
    }
    return c.json(await buildStatus(c.env));
  }
);

export default settings;
