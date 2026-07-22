import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "../types";
import { generateApiKey, generateId } from "../lib/id";
import { hashPassword } from "../lib/password";

const setup = new Hono<{ Bindings: Env }>();

// 初回起動時にオーナー(owner)アカウントを1件だけ発行するブートストラップ用エンドポイント。
// staff テーブルが空の間だけ動作し、以後は 409 を返す。
setup.post(
  "/init",
  zValidator(
    "json",
    z.object({ name: z.string().min(1), password: z.string().min(8).optional() })
  ),
  async (c) => {
    const existing = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM staff").first<{
      count: number;
    }>();
    if ((existing?.count ?? 0) > 0) {
      return c.json({ error: "Setup already completed" }, 409);
    }

    const { name, password } = c.req.valid("json");
    const id = generateId("staff");
    const apiKey = generateApiKey();
    const passwordHash = password ? await hashPassword(password) : null;

    await c.env.DB.prepare(
      "INSERT INTO staff (id, name, role, api_key, password_hash) VALUES (?, ?, 'owner', ?, ?)"
    )
      .bind(id, name, apiKey, passwordHash)
      .run();

    return c.json(
      {
        id,
        name,
        role: "owner",
        api_key: apiKey,
        note: "この api_key は二度と表示されません。安全な場所に保管してください。",
      },
      201
    );
  }
);

export default setup;
