import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "../types";
import { verifyLineIdToken, type VerifiedLineUser } from "../lib/line";
import { generateId } from "../lib/id";

const liff = new Hono<{ Bindings: Env }>();

async function authenticateLineUser(
  authHeader: string | undefined,
  channelId: string
): Promise<VerifiedLineUser | null> {
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return null;
  return verifyLineIdToken(idToken, channelId);
}

async function requireGuardian(c: Context<{ Bindings: Env }>): Promise<{ id: string } | null> {
  const verified = await authenticateLineUser(c.req.header("Authorization"), c.env.LIFF_CHANNEL_ID);
  if (!verified) return null;
  return c.env.DB.prepare("SELECT id FROM guardians WHERE line_user_id = ?")
    .bind(verified.sub)
    .first<{ id: string }>();
}

// 保護者がLIFFで招待コードを入力し、生徒と紐付けるエンドポイント
liff.post(
  "/link",
  zValidator("json", z.object({ idToken: z.string().min(1), code: z.string().min(1) })),
  async (c) => {
    const { idToken, code } = c.req.valid("json");
    const verified = await verifyLineIdToken(idToken, c.env.LIFF_CHANNEL_ID);
    if (!verified) return c.json({ error: "IDトークンの検証に失敗しました" }, 401);

    const invite = await c.env.DB.prepare(
      "SELECT * FROM invite_codes WHERE code = ? AND used_at IS NULL"
    )
      .bind(code.toUpperCase())
      .first<{ id: string; student_id: string; expires_at: string }>();
    if (!invite) return c.json({ error: "招待コードが無効です" }, 404);
    if (new Date(invite.expires_at) < new Date()) {
      return c.json({ error: "招待コードの有効期限が切れています" }, 410);
    }

    let guardian = await c.env.DB.prepare("SELECT id FROM guardians WHERE line_user_id = ?")
      .bind(verified.sub)
      .first<{ id: string }>();

    if (!guardian) {
      const guardianId = generateId("guardian");
      await c.env.DB.prepare("INSERT INTO guardians (id, line_user_id, name) VALUES (?, ?, ?)")
        .bind(guardianId, verified.sub, verified.name ?? null)
        .run();
      guardian = { id: guardianId };
    }

    await c.env.DB.prepare(
      "INSERT OR REPLACE INTO student_guardians (student_id, guardian_id, relation) VALUES (?, ?, ?)"
    )
      .bind(invite.student_id, guardian.id, "保護者")
      .run();

    await c.env.DB.prepare(
      "UPDATE invite_codes SET used_at = datetime('now'), used_by_guardian_id = ? WHERE id = ?"
    )
      .bind(guardian.id, invite.id)
      .run();

    const student = await c.env.DB.prepare("SELECT id, name FROM students WHERE id = ?")
      .bind(invite.student_id)
      .first<{ id: string; name: string }>();

    return c.json({ guardian_id: guardian.id, student });
  }
);

// ログイン中保護者自身の情報 + 紐付けられた生徒一覧
liff.get("/me", async (c) => {
  const verified = await authenticateLineUser(c.req.header("Authorization"), c.env.LIFF_CHANNEL_ID);
  if (!verified) return c.json({ error: "認証に失敗しました" }, 401);

  const guardian = await c.env.DB.prepare("SELECT * FROM guardians WHERE line_user_id = ?")
    .bind(verified.sub)
    .first<Record<string, unknown>>();
  if (!guardian) return c.json({ error: "保護者情報が見つかりません" }, 404);

  const { results: studentRows } = await c.env.DB.prepare(
    `SELECT s.id, s.name, s.grade, s.course, s.status, sg.relation
     FROM students s
     JOIN student_guardians sg ON sg.student_id = s.id
     WHERE sg.guardian_id = ?`
  )
    .bind(guardian.id)
    .all();

  return c.json({
    id: guardian.id,
    name: guardian.name,
    push_notifications_enabled: !!guardian.push_notifications_enabled,
    students: studentRows ?? [],
  });
});

liff.patch(
  "/me",
  zValidator("json", z.object({ push_notifications_enabled: z.boolean() })),
  async (c) => {
    const verified = await authenticateLineUser(c.req.header("Authorization"), c.env.LIFF_CHANNEL_ID);
    if (!verified) return c.json({ error: "認証に失敗しました" }, 401);
    const { push_notifications_enabled } = c.req.valid("json");
    await c.env.DB.prepare("UPDATE guardians SET push_notifications_enabled = ? WHERE line_user_id = ?")
      .bind(push_notifications_enabled ? 1 : 0, verified.sub)
      .run();
    return c.json({ push_notifications_enabled });
  }
);

// 保護者自身と紐付けられた生徒の欠席・振替連絡一覧
liff.get("/absences", async (c) => {
  const guardian = await requireGuardian(c);
  if (!guardian) return c.json({ error: "認証に失敗しました" }, 401);

  const { results } = await c.env.DB.prepare(
    `SELECT a.*, s.name AS student_name FROM absence_requests a
     JOIN students s ON s.id = a.student_id
     JOIN student_guardians sg ON sg.student_id = a.student_id
     WHERE sg.guardian_id = ?
     ORDER BY a.date DESC, a.created_at DESC`
  )
    .bind(guardian.id)
    .all();

  return c.json({ absences: results ?? [] });
});

const liffAbsenceInput = z.object({
  student_id: z.string().min(1),
  class_id: z.string().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().nullable().optional(),
});

liff.post("/absences", zValidator("json", liffAbsenceInput), async (c) => {
  const guardian = await requireGuardian(c);
  if (!guardian) return c.json({ error: "認証に失敗しました" }, 401);

  const body = c.req.valid("json");
  const link = await c.env.DB.prepare(
    "SELECT 1 FROM student_guardians WHERE student_id = ? AND guardian_id = ?"
  )
    .bind(body.student_id, guardian.id)
    .first();
  if (!link) return c.json({ error: "この生徒との連携が確認できません" }, 403);

  const id = generateId("absence");
  await c.env.DB.prepare(
    `INSERT INTO absence_requests (id, student_id, class_id, date, reason, status)
     VALUES (?, ?, ?, ?, ?, '申請')`
  )
    .bind(id, body.student_id, body.class_id ?? null, body.date, body.reason ?? null)
    .run();

  const row = await c.env.DB.prepare("SELECT * FROM absence_requests WHERE id = ?").bind(id).first();
  return c.json(row, 201);
});

// 教室側が提案した振替日を保護者が承認する
liff.post("/absences/:id/confirm", async (c) => {
  const guardian = await requireGuardian(c);
  if (!guardian) return c.json({ error: "認証に失敗しました" }, 401);

  const id = c.req.param("id");
  const absence = await c.env.DB.prepare(
    `SELECT a.id, a.status FROM absence_requests a
     JOIN student_guardians sg ON sg.student_id = a.student_id
     WHERE a.id = ? AND sg.guardian_id = ?`
  )
    .bind(id, guardian.id)
    .first<{ id: string; status: string }>();
  if (!absence) return c.json({ error: "Not found" }, 404);
  if (absence.status !== "振替提案") {
    return c.json({ error: "振替提案の状態でのみ確定できます" }, 409);
  }

  await c.env.DB.prepare("UPDATE absence_requests SET status = '確定' WHERE id = ?").bind(id).run();
  const row = await c.env.DB.prepare("SELECT * FROM absence_requests WHERE id = ?").bind(id).first();
  return c.json(row);
});

export default liff;
export { authenticateLineUser };
