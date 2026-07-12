import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { hashPassword, verifyPassword } from "../lib/password";

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

// 名前＋パスワードでログインし、APIキーを取得する(APIキー不要)。
// 認証自体は従来どおりAPIキーで行うため、ログイン後はこのキーを保存して使う。
auth.post(
  "/login",
  zValidator("json", z.object({ name: z.string().min(1), password: z.string().min(1) })),
  async (c) => {
    const { name, password } = c.req.valid("json");
    const { results } = await c.env.DB.prepare(
      "SELECT id, name, role, api_key, password_hash FROM staff WHERE name = ? AND password_hash IS NOT NULL"
    )
      .bind(name)
      .all<{
        id: string;
        name: string;
        role: string;
        api_key: string;
        password_hash: string;
      }>();

    for (const staff of results ?? []) {
      if (await verifyPassword(password, staff.password_hash)) {
        return c.json({
          api_key: staff.api_key,
          staff: { id: staff.id, name: staff.name, role: staff.role },
        });
      }
    }
    return c.json({ error: "名前またはパスワードが違います" }, 401);
  }
);

// ログイン中のスタッフが自分のパスワードを設定・変更する(APIキーが必要)。
auth.post(
  "/set-password",
  requireAuth,
  zValidator("json", z.object({ password: z.string().min(8) })),
  async (c) => {
    const staff = c.get("staff");
    const hash = await hashPassword(c.req.valid("json").password);
    await c.env.DB.prepare("UPDATE staff SET password_hash = ? WHERE id = ?")
      .bind(hash, staff.id)
      .run();
    return c.json({ ok: true });
  }
);

export default auth;
