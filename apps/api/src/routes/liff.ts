import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "../types";
import { verifyLineIdToken, type VerifiedLineUser } from "../lib/line";
import { generateId } from "../lib/id";
import { parseJsonArray, parseJsonObject } from "../lib/json";
import { renderInvoiceHtml } from "../lib/invoice-html";
import { getSetting } from "../lib/notify";

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
    `SELECT a.*, s.name AS student_name, cc.name AS class_name, mc.name AS makeup_class_name
     FROM absence_requests a
     JOIN students s ON s.id = a.student_id
     JOIN student_guardians sg ON sg.student_id = a.student_id
     LEFT JOIN classes cc ON cc.id = a.class_id
     LEFT JOIN classes mc ON mc.id = a.makeup_class_id
     WHERE sg.guardian_id = ?
     ORDER BY a.date DESC, a.created_at DESC`
  )
    .bind(guardian.id)
    .all();

  return c.json({ absences: results ?? [] });
});

interface MakeupOption {
  class_id: string;
  class_name: string;
  date: string;
  weekday: number;
  start_time: string;
  end_time: string;
  remaining: number | null;
}

// 今日以降 weeksAhead 週間分の「空きのある振替枠」を、クラスの定員・在籍数・
// 既に埋まっている振替予約数から計算する(競合の学習塾システムと同様、
// 保護者が空き枠から直接選べるようにするため)。
async function computeMakeupOptions(env: Env, weeksAhead = 4): Promise<MakeupOption[]> {
  const { results: classRows } = await env.DB.prepare(
    `SELECT c.id, c.name, c.weekday, c.start_time, c.end_time, c.capacity,
            (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status = '在籍') AS enrolled
     FROM classes c
     WHERE c.archived_at IS NULL`
  ).all<{
    id: string;
    name: string;
    weekday: number;
    start_time: string;
    end_time: string;
    capacity: number | null;
    enrolled: number;
  }>();
  const classes = classRows ?? [];
  if (classes.length === 0) return [];

  const { results: makeupRows } = await env.DB.prepare(
    `SELECT makeup_class_id, makeup_date, COUNT(*) AS cnt FROM absence_requests
     WHERE makeup_class_id IS NOT NULL AND makeup_date IS NOT NULL AND status IN ('振替提案', '確定')
     GROUP BY makeup_class_id, makeup_date`
  ).all<{ makeup_class_id: string; makeup_date: string; cnt: number }>();
  const usedMap = new Map<string, number>();
  for (const r of makeupRows ?? []) {
    usedMap.set(`${r.makeup_class_id}|${r.makeup_date}`, r.cnt);
  }

  // 日本時間の「今日」を基準に、明日から weeksAhead*7 日分を候補にする
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const options: MakeupOption[] = [];
  for (let offset = 1; offset <= weeksAhead * 7; offset++) {
    const d = new Date(Date.UTC(nowJst.getUTCFullYear(), nowJst.getUTCMonth(), nowJst.getUTCDate() + offset));
    const weekday = d.getUTCDay();
    const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
      d.getUTCDate()
    ).padStart(2, "0")}`;
    for (const cls of classes) {
      if (cls.weekday !== weekday) continue;
      const used = usedMap.get(`${cls.id}|${dateStr}`) ?? 0;
      const remaining = cls.capacity == null ? null : cls.capacity - cls.enrolled - used;
      if (remaining !== null && remaining <= 0) continue;
      options.push({
        class_id: cls.id,
        class_name: cls.name,
        date: dateStr,
        weekday,
        start_time: cls.start_time,
        end_time: cls.end_time,
        remaining,
      });
    }
  }
  options.sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
  return options;
}

// 特定の欠席連絡に対して、保護者が選べる振替の空き枠一覧を返す
liff.get("/absences/:id/makeup-options", async (c) => {
  const guardian = await requireGuardian(c);
  if (!guardian) return c.json({ error: "認証に失敗しました" }, 401);

  const id = c.req.param("id");
  const absence = await c.env.DB.prepare(
    `SELECT a.id FROM absence_requests a
     JOIN student_guardians sg ON sg.student_id = a.student_id
     WHERE a.id = ? AND sg.guardian_id = ?`
  )
    .bind(id, guardian.id)
    .first();
  if (!absence) return c.json({ error: "Not found" }, 404);

  const options = await computeMakeupOptions(c.env);
  return c.json({ options });
});

// 保護者が空き枠から振替日時を選び、その場で確定する(自己解決型)。
// 選択時点の空きを再確認してから確定するため、二重予約を防ぐ。
liff.post(
  "/absences/:id/select-makeup",
  zValidator(
    "json",
    z.object({ class_id: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
  ),
  async (c) => {
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
    if (absence.status === "確定") {
      return c.json({ error: "この欠席連絡は既に振替が確定しています" }, 409);
    }

    const { class_id, date } = c.req.valid("json");
    const options = await computeMakeupOptions(c.env);
    const chosen = options.find((o) => o.class_id === class_id && o.date === date);
    if (!chosen) {
      return c.json({ error: "選択した枠は既に埋まっているか、対象外です。別の枠をお選びください。" }, 409);
    }

    await c.env.DB.prepare(
      "UPDATE absence_requests SET status = '確定', makeup_date = ?, makeup_class_id = ? WHERE id = ?"
    )
      .bind(date, class_id, id)
      .run();

    const row = await c.env.DB.prepare(
      `SELECT a.*, mc.name AS makeup_class_name FROM absence_requests a
       LEFT JOIN classes mc ON mc.id = a.makeup_class_id
       WHERE a.id = ?`
    )
      .bind(id)
      .first();
    return c.json(row);
  }
);

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

// 保護者自身と紐付けられた生徒宛の送信済み指導報告書一覧
liff.get("/reports", async (c) => {
  const guardian = await requireGuardian(c);
  if (!guardian) return c.json({ error: "認証に失敗しました" }, 401);

  const { results } = await c.env.DB.prepare(
    `SELECT r.*, s.name AS student_name FROM reports r
     JOIN students s ON s.id = r.student_id
     JOIN student_guardians sg ON sg.student_id = r.student_id
     WHERE sg.guardian_id = ? AND r.sent_at IS NOT NULL
     ORDER BY r.sent_at DESC`
  )
    .bind(guardian.id)
    .all();

  return c.json({ reports: results ?? [] });
});

liff.post("/reports/:id/read", async (c) => {
  const guardian = await requireGuardian(c);
  if (!guardian) return c.json({ error: "認証に失敗しました" }, 401);

  const id = c.req.param("id");
  const report = await c.env.DB.prepare(
    `SELECT r.id FROM reports r
     JOIN student_guardians sg ON sg.student_id = r.student_id
     WHERE r.id = ? AND sg.guardian_id = ?`
  )
    .bind(id, guardian.id)
    .first();
  if (!report) return c.json({ error: "Not found" }, 404);

  await c.env.DB.prepare("UPDATE reports SET read_at = COALESCE(read_at, datetime('now')) WHERE id = ?")
    .bind(id)
    .run();
  return c.json({ read: true });
});

// 保護者自身と紐付けられた生徒が対象に含まれるお知らせ一覧(セグメント一致で判定)
liff.get("/announcements", async (c) => {
  const guardian = await requireGuardian(c);
  if (!guardian) return c.json({ error: "認証に失敗しました" }, 401);

  const { results: studentRows } = await c.env.DB.prepare(
    `SELECT s.class_id, s.tags FROM students s
     JOIN student_guardians sg ON sg.student_id = s.id
     WHERE sg.guardian_id = ?`
  )
    .bind(guardian.id)
    .all<{ class_id: string | null; tags: string | null }>();

  const classIds = new Set((studentRows ?? []).map((s) => s.class_id).filter((v): v is string => !!v));
  const tags = new Set<string>();
  (studentRows ?? []).forEach((s) => {
    parseJsonArray(s.tags).forEach((t) => tags.add(String(t)));
  });

  const { results: announcementRows } = await c.env.DB.prepare(
    `SELECT a.*, ar.read_at FROM announcements a
     LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.guardian_id = ?
     WHERE a.sent_at IS NOT NULL
     ORDER BY a.sent_at DESC LIMIT 100`
  )
    .bind(guardian.id)
    .all<Record<string, unknown>>();

  const matched = (announcementRows ?? []).filter((row) => {
    const segment = parseJsonObject(row.segment as string) as {
      type: string;
      class_id?: string;
      tag?: string;
    };
    if (segment.type === "all") return true;
    if (segment.type === "class") return segment.class_id ? classIds.has(segment.class_id) : false;
    if (segment.type === "tag") return segment.tag ? tags.has(segment.tag) : false;
    return false;
  });

  return c.json({
    announcements: matched.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      sent_at: row.sent_at,
      read_at: row.read_at ?? null,
    })),
  });
});

liff.post("/announcements/:id/read", async (c) => {
  const guardian = await requireGuardian(c);
  if (!guardian) return c.json({ error: "認証に失敗しました" }, 401);
  const id = c.req.param("id");
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO announcement_reads (announcement_id, guardian_id) VALUES (?, ?)"
  )
    .bind(id, guardian.id)
    .run();
  return c.json({ read: true });
});

// 保護者自身と紐付けられた生徒宛の送信済み請求書一覧
liff.get("/invoices", async (c) => {
  const guardian = await requireGuardian(c);
  if (!guardian) return c.json({ error: "認証に失敗しました" }, 401);

  const { results } = await c.env.DB.prepare(
    `SELECT i.id, i.year_month, i.total, i.paid_status, i.sent_at, i.payment_reported_at,
            s.name AS student_name
     FROM invoices i
     JOIN students s ON s.id = i.student_id
     JOIN student_guardians sg ON sg.student_id = i.student_id
     WHERE sg.guardian_id = ? AND i.sent_at IS NOT NULL
     ORDER BY i.year_month DESC`
  )
    .bind(guardian.id)
    .all();

  return c.json({ invoices: results ?? [] });
});

// 振込先口座の情報(教室が設定画面で登録したもの)を保護者に見せる
liff.get("/payment-info", async (c) => {
  const guardian = await requireGuardian(c);
  if (!guardian) return c.json({ error: "認証に失敗しました" }, 401);
  const bank = {
    bank_name: await getSetting(c.env, "bank_name", ""),
    bank_branch: await getSetting(c.env, "bank_branch", ""),
    bank_account_type: await getSetting(c.env, "bank_account_type", ""),
    bank_account_number: await getSetting(c.env, "bank_account_number", ""),
    bank_account_holder: await getSetting(c.env, "bank_account_holder", ""),
    payment_note: await getSetting(c.env, "payment_note", ""),
  };
  const configured = Boolean(bank.bank_name || bank.bank_account_number);
  return c.json({ bank_transfer: bank, configured });
});

// 保護者が「振り込みました」と報告する。paid_status は変えず(教室の確認前なので)、
// 報告時刻とメモだけ記録して「入金確認待ち」の状態にする。
liff.post(
  "/invoices/:id/report-payment",
  zValidator("json", z.object({ note: z.string().max(200).nullable().optional() })),
  async (c) => {
    const guardian = await requireGuardian(c);
    if (!guardian) return c.json({ error: "認証に失敗しました" }, 401);
    const id = c.req.param("id");
    const row = await c.env.DB.prepare(
      `SELECT i.id, i.paid_status FROM invoices i
       JOIN student_guardians sg ON sg.student_id = i.student_id
       WHERE i.id = ? AND sg.guardian_id = ?`
    )
      .bind(id, guardian.id)
      .first<{ id: string; paid_status: string }>();
    if (!row) return c.json({ error: "Not found" }, 404);
    if (row.paid_status === "入金済") return c.json({ error: "既に入金済みです" }, 409);

    await c.env.DB.prepare(
      "UPDATE invoices SET payment_reported_at = datetime('now'), payment_report_note = ? WHERE id = ?"
    )
      .bind(c.req.valid("json").note ?? null, id)
      .run();
    return c.json({ ok: true });
  }
);

liff.get("/invoices/:id/print", async (c) => {
  const guardian = await requireGuardian(c);
  if (!guardian) return c.json({ error: "認証に失敗しました" }, 401);

  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT i.*, s.name AS student_name FROM invoices i
     JOIN students s ON s.id = i.student_id
     JOIN student_guardians sg ON sg.student_id = i.student_id
     WHERE i.id = ? AND sg.guardian_id = ?`
  )
    .bind(id, guardian.id)
    .first<{ student_name: string; year_month: string; items: string; total: number }>();
  if (!row) return c.json({ error: "Not found" }, 404);

  const html = renderInvoiceHtml({
    schoolName: "School Harness",
    studentName: row.student_name,
    yearMonth: row.year_month,
    items: parseJsonArray(row.items) as { label: string; amount: number }[],
    total: row.total,
    issuedAt: new Date().toLocaleDateString("ja-JP"),
  });
  return c.html(html);
});

export default liff;
export { authenticateLineUser };
