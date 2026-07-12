import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { hashPassword, verifyPassword } from "../lib/password";
import {
  generateBase32Secret,
  verifyTotp,
  buildOtpAuthUri,
  generateRecoveryCode,
  hashRecoveryCode,
} from "../lib/totp";
import { generateApiKey, generateId } from "../lib/id";

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

const RECOVERY_CODE_COUNT = 8;

// スタッフのリカバリーコードを作り直して保存し、平文の一覧を返す(表示は一度きり)。
async function regenerateRecoveryCodes(env: Env, staffId: string): Promise<string[]> {
  await env.DB.prepare("DELETE FROM recovery_codes WHERE staff_id = ?").bind(staffId).run();
  const codes: string[] = [];
  const statements = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const code = generateRecoveryCode();
    codes.push(code);
    statements.push(
      env.DB.prepare(
        "INSERT INTO recovery_codes (id, staff_id, code_hash) VALUES (?, ?, ?)"
      ).bind(generateId("rc"), staffId, await hashRecoveryCode(code))
    );
  }
  await env.DB.batch(statements);
  return codes;
}

// TOTPコード、またはリカバリーコードのどちらかで検証する。
// リカバリーコードが一致した場合は使用済みにする(1回限り)。
async function verifyTotpOrRecovery(
  env: Env,
  staffId: string,
  secret: string,
  code: string
): Promise<boolean> {
  if (await verifyTotp(secret, code)) return true;
  const hash = await hashRecoveryCode(code);
  const row = await env.DB.prepare(
    "SELECT id FROM recovery_codes WHERE staff_id = ? AND code_hash = ? AND used_at IS NULL"
  )
    .bind(staffId, hash)
    .first<{ id: string }>();
  if (!row) return false;
  await env.DB.prepare("UPDATE recovery_codes SET used_at = datetime('now') WHERE id = ?")
    .bind(row.id)
    .run();
  return true;
}

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
          if (!(await verifyTotpOrRecovery(c.env, staff.id, staff.totp_secret, code))) {
            return c.json(
              { error: "認証コード(またはリカバリーコード)が正しくありません", totp_required: true },
              401
            );
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
    // 端末紛失時に備えたリカバリーコードを発行して返す(表示は一度きり)
    const recoveryCodes = await regenerateRecoveryCodes(c.env, staff.id);
    return c.json({ ok: true, recovery_codes: recoveryCodes });
  }
);

// リカバリーコードを再発行する(古いコードは無効になる)。
auth.post("/totp/recovery-codes", requireAuth, async (c) => {
  const staff = c.get("staff");
  const row = await c.env.DB.prepare("SELECT totp_enabled FROM staff WHERE id = ?")
    .bind(staff.id)
    .first<{ totp_enabled: number }>();
  if (row?.totp_enabled !== 1) {
    return c.json({ error: "2段階認証が有効ではありません" }, 400);
  }
  const recoveryCodes = await regenerateRecoveryCodes(c.env, staff.id);
  return c.json({ recovery_codes: recoveryCodes });
});

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
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE staff SET totp_enabled = 0, totp_secret = NULL WHERE id = ?").bind(
        staff.id
      ),
      c.env.DB.prepare("DELETE FROM recovery_codes WHERE staff_id = ?").bind(staff.id),
    ]);
    return c.json({ ok: true });
  }
);

// ログイン中スタッフの2段階認証の状態(未使用リカバリーコード数を含む)を返す。
auth.get("/totp/status", requireAuth, async (c) => {
  const staff = c.get("staff");
  const row = await c.env.DB.prepare("SELECT totp_enabled FROM staff WHERE id = ?")
    .bind(staff.id)
    .first<{ totp_enabled: number }>();
  const rc = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM recovery_codes WHERE staff_id = ? AND used_at IS NULL"
  )
    .bind(staff.id)
    .first<{ count: number }>();
  return c.json({ enabled: row?.totp_enabled === 1, recovery_codes_remaining: rc?.count ?? 0 });
});

export default auth;
