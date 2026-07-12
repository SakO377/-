import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env, Variables } from "../types";
import { requireAuth, requireRole } from "../middleware/auth";
import { generateApiKey, generateId } from "../lib/id";

const staff = new Hono<{ Bindings: Env; Variables: Variables }>();
staff.use("*", requireAuth);

// スタッフ名の一覧(指導報告書の担当講師の選択肢などに使う)。
// 一覧・作成・削除はオーナー専用だが、名前だけはどのスタッフでも参照できるよう
// requireRole より前に登録する。
staff.get("/names", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, name FROM staff ORDER BY created_at"
  ).all();
  return c.json({ staff: results ?? [] });
});

staff.use("*", requireRole("owner"));

// api_key は返さない(発行時に一度だけ表示)
staff.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, role, created_at FROM staff ORDER BY created_at"
  ).all();
  return c.json({ staff: results ?? [], me: c.get("staff").id });
});

staff.post(
  "/",
  zValidator(
    "json",
    z.object({ name: z.string().min(1), role: z.enum(["owner", "admin", "staff"]) })
  ),
  async (c) => {
    const { name, role } = c.req.valid("json");
    const id = generateId("staff");
    const apiKey = generateApiKey();
    await c.env.DB.prepare("INSERT INTO staff (id, name, role, api_key) VALUES (?, ?, ?, ?)")
      .bind(id, name, role, apiKey)
      .run();
    return c.json(
      {
        id,
        name,
        role,
        api_key: apiKey,
        note: "この api_key は二度と表示されません。本人に安全な方法で渡してください。",
      },
      201
    );
  }
);

staff.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const me = c.get("staff");
  if (id === me.id) {
    return c.json({ error: "自分自身は削除できません" }, 400);
  }
  const target = await c.env.DB.prepare("SELECT id, role FROM staff WHERE id = ?")
    .bind(id)
    .first<{ id: string; role: string }>();
  if (!target) return c.json({ error: "Not found" }, 404);

  if (target.role === "owner") {
    const owners = await c.env.DB.prepare(
      "SELECT COUNT(*) AS count FROM staff WHERE role = 'owner'"
    ).first<{ count: number }>();
    if ((owners?.count ?? 0) <= 1) {
      return c.json({ error: "最後のオーナーは削除できません" }, 400);
    }
  }

  await c.env.DB.prepare("DELETE FROM staff WHERE id = ?").bind(id).run();
  return c.body(null, 204);
});

// オーナーが他スタッフの2段階認証を解除する(端末紛失・退職時の復旧用)。
staff.post("/:id/reset-2fa", async (c) => {
  const id = c.req.param("id");
  const target = await c.env.DB.prepare("SELECT id FROM staff WHERE id = ?").bind(id).first();
  if (!target) return c.json({ error: "Not found" }, 404);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE staff SET totp_enabled = 0, totp_secret = NULL WHERE id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM recovery_codes WHERE staff_id = ?").bind(id),
  ]);
  return c.json({ ok: true });
});

export default staff;
