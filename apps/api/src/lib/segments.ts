import type { Env } from "../types";
import { parseJsonArray } from "./json";

export interface Segment {
  type: "all" | "class" | "tag";
  class_id?: string;
  tag?: string;
}

export interface SegmentGuardian {
  id: string;
  line_user_id: string | null;
  push_notifications_enabled: boolean;
}

/** お知らせの配信対象(セグメント)を、対象生徒に紐付く保護者一覧へ解決する */
export async function resolveSegmentGuardians(env: Env, segment: Segment): Promise<SegmentGuardian[]> {
  let studentRows: { id: string; tags: string | null }[];

  if (segment.type === "class" && segment.class_id) {
    const { results } = await env.DB.prepare(
      "SELECT id, tags FROM students WHERE status = '在籍' AND class_id = ?"
    )
      .bind(segment.class_id)
      .all<{ id: string; tags: string | null }>();
    studentRows = results ?? [];
  } else {
    const { results } = await env.DB.prepare(
      "SELECT id, tags FROM students WHERE status = '在籍'"
    ).all<{ id: string; tags: string | null }>();
    studentRows = results ?? [];
  }

  const filtered =
    segment.type === "tag" && segment.tag
      ? studentRows.filter((s) => parseJsonArray(s.tags).includes(segment.tag))
      : studentRows;

  if (filtered.length === 0) return [];

  const placeholders = filtered.map(() => "?").join(",");
  const { results: guardianRows } = await env.DB.prepare(
    `SELECT DISTINCT g.id, g.line_user_id, g.push_notifications_enabled
     FROM guardians g
     JOIN student_guardians sg ON sg.guardian_id = g.id
     WHERE sg.student_id IN (${placeholders})`
  )
    .bind(...filtered.map((s) => s.id))
    .all<{ id: string; line_user_id: string | null; push_notifications_enabled: number }>();

  return (guardianRows ?? []).map((g) => ({
    ...g,
    push_notifications_enabled: !!g.push_notifications_enabled,
  }));
}
