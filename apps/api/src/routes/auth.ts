import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { hashPassword, verifyPassword } from "../lib/password";
import { generateBase32Secret, verifyTotp, buildOtpAuthUri } from "../lib/totp";
import { generateApiKey } from "../lib/id";

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

// 名前＋パスワードでログインし、APIキーを取得する(APIキー不要)。
// 認証自体は従来どおりAPIキーで行うため、ログイン後はこのキーを保存して使う。
// 2段階認証が有効なスタッフは、正しいTOTPコードも必要。
auth.post(
  "/login",
  zValidator(
    "json",
    z.object({ name: z.string().min(1), password: z.string().min(1), code: z.string().optional() })
  ),
  async (c) => {
    const { name, password, code } = c.req.valid("json");
    const { results } = await c.env.DB.prepare(
      "SELECT id, name, role, api_key, password_hash, totp_enabled, totp_secret FROM staff WHERE name = ? AND password_hash IS NOT NULL"
    )
      .bind(name)
      .all<{
        id: string;
        name: string;
        role: string;
        api_key: string;
        password_hash: string;
        totp_enabled: number;
        totp_secret: string | null;
      }>();

    for (const staff of results ?? []) {
      if (await verifyPassword(password, staff.password_hash)) {
        if (staff.totp_enabled === 1 && staff.totp_secret) {
          if (!code) {
            return c.json({ error: "認証コードを入力してください", totp_required: true }, 401);
          }
          if (!(await verifyTotp(staff.totp_secret, code))) {
            return c.json({ error: "認証コードが正しくありません", totp_required: true }, 401);
          }
        }
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

// 現在のAPIキーを無効化し、新しいAPIキーを発行する(漏洩時のローテーション用)。
auth.post("/rotate-key", requireAuth, async (c) => {
  const staff = c.get("staff");
  const newKey = generateApiKey();
  await c.env.DB.prepare("UPDATE staff SET api_key = ? WHERE id = ?").bind(newKey, staff.id).run();
  return c.json({ api_key: newKey });
});

// 2段階認証の設定を開始する。シークレットを保存(未有効)し、認証アプリ用のURIを返す。
auth.post("/totp/setup", requireAuth, async (c) => {
  const staff = c.get("staff");
  const secret = generateBase32Secret();
  await c.env.DB.prepare("UPDATE staff SET totp_secret = ?, totp_enabled = 0 WHERE id = ?")
    .bind(secret, staff.id)
    .run();
  return c.json({ secret, otpauth_uri: buildOtpAuthUri(secret, staff.name) });
});

// 認証アプリで生成したコードを検証し、2段階認証を有効化する。
auth.post(
  "/totp/enable",
  requireAuth,
  zValidator("json", z.object({ code: z.string().min(6) })),
  async (c) => {
    const staff = c.get("staff");
    const row = await c.env.DB.prepare("SELECT totp_secret FROM staff WHERE id = ?")
      .bind(staff.id)
      .first<{ totp_secret: string | null }>();
    if (!row?.totp_secret) return c.json({ error: "先に設定を開始してください" }, 400);
    if (!(await verifyTotp(row.totp_secret, c.req.valid("json").code))) {
      return c.json({ error: "認証コードが正しくありません" }, 400);
    }
    await c.env.DB.prepare("UPDATE staff SET totp_enabled = 1 WHERE id = ?").bind(staff.id).run();
    return c.json({ ok: true });
  }
);

// 2段階認証を無効化する(パスワード再確認を必須にする)。
auth.post(
  "/totp/disable",
  requireAuth,
  zValidator("json", z.object({ password: z.string().min(1) })),
  async (c) => {
    const staff = c.get("staff");
    const row = await c.env.DB.prepare("SELECT password_hash FROM staff WHERE id = ?")
      .bind(staff.id)
      .first<{ password_hash: string | null }>();
    if (!row?.password_hash || !(await verifyPassword(c.req.valid("json").password, row.password_hash))) {
      return c.json({ error: "パスワードが正しくありません" }, 401);
    }
    await c.env.DB.prepare("UPDATE staff SET totp_enabled = 0, totp_secret = NULL WHERE id = ?")
      .bind(staff.id)
      .run();
    return c.json({ ok: true });
  }
);

// ログイン中スタッフの2段階認証の状態を返す。
auth.get("/totp/status", requireAuth, async (c) => {
  const staff = c.get("staff");
  const row = await c.env.DB.prepare("SELECT totp_enabled FROM staff WHERE id = ?")
    .bind(staff.id)
    .first<{ totp_enabled: number }>();
  return c.json({ enabled: row?.totp_enabled === 1 });
});

export default auth;
