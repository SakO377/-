import type { Env } from "../types";
import { generateId } from "./id";
import { pushMessage, type LineMessage } from "./line";

/** 当月(UTC基準)に消費した無料メッセージ枠(push/multicastの受信者数合計) */
export async function getMonthlyPushCount(env: Env): Promise<number> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(recipient_count), 0) AS total FROM line_message_log
     WHERE message_type IN ('push', 'multicast') AND sent_at >= ?`
  )
    .bind(monthStart.toISOString())
    .first<{ total: number }>();
  return row?.total ?? 0;
}

export async function getSetting(env: Env, key: string, fallback: string): Promise<string> {
  const row = await env.DB.prepare("SELECT value FROM app_settings WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? fallback;
}

export async function setSetting(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  )
    .bind(key, value)
    .run();
}

interface NotifyResult {
  /** 通知対象(Push希望・LINE連携済み)の保護者数 */
  attempted: number;
  /** 実際にPushを送信できた件数 */
  sent: number;
  /** 無料枠残量不足のため送信をスキップしたか */
  skippedQuota: boolean;
}

/**
 * 生徒に紐付く保護者(Push通知ON・LINE連携済み)へPush通知を送る。
 * 当月の無料枠(LINE_FREE_PUSH_QUOTA)を超える場合は送信せず、
 * 保護者はLIFF内の履歴画面で確認する(プル型フォールバック)。
 */
export async function notifyGuardiansOfStudent(
  env: Env,
  studentId: string,
  purpose: string,
  buildMessage: (guardianName: string | null) => LineMessage[]
): Promise<NotifyResult> {
  const { results: guardianRows } = await env.DB.prepare(
    `SELECT g.id, g.line_user_id, g.name FROM guardians g
     JOIN student_guardians sg ON sg.guardian_id = g.id
     WHERE sg.student_id = ? AND g.push_notifications_enabled = 1 AND g.line_user_id IS NOT NULL`
  )
    .bind(studentId)
    .all<{ id: string; line_user_id: string; name: string | null }>();

  const guardians = guardianRows ?? [];
  if (guardians.length === 0) {
    return { attempted: 0, sent: 0, skippedQuota: false };
  }

  const quota = Number(env.LINE_FREE_PUSH_QUOTA || "200");
  const used = await getMonthlyPushCount(env);
  const remaining = quota - used;

  if (remaining < guardians.length) {
    return { attempted: guardians.length, sent: 0, skippedQuota: true };
  }

  let sent = 0;
  for (const guardian of guardians) {
    const res = await pushMessage(
      env.LINE_CHANNEL_ACCESS_TOKEN,
      guardian.line_user_id,
      buildMessage(guardian.name)
    );
    if (res.ok) {
      sent += 1;
      await env.DB.prepare(
        "INSERT INTO line_message_log (id, message_type, purpose, recipient_count) VALUES (?, 'push', ?, 1)"
      )
        .bind(generateId("msg"), purpose)
        .run();
    }
  }

  return { attempted: guardians.length, sent, skippedQuota: false };
}
