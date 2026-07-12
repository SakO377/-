import type { Env } from "../types";
import { getSetting, setSetting } from "./notify";

// プリセット学年の進級マップ。最上位(高3)はここに載せず据え置きにする。
// 自由入力の学年(マップにないもの)は対象外(そのまま)。
const NEXT_GRADE: Record<string, string> = {
  年少: "年中",
  年中: "年長",
  年長: "小1",
  小1: "小2",
  小2: "小3",
  小3: "小4",
  小4: "小5",
  小5: "小6",
  小6: "中1",
  中1: "中2",
  中2: "中3",
  中3: "高1",
  高1: "高2",
  高2: "高3",
};

const LAST_RUN_KEY = "last_grade_promotion_year";

/** UTCの現在時刻を日本時間(UTC+9)に変換した年月日を返す。 */
function jstParts(now: Date): { year: number; month: number; day: number } {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return {
    year: jst.getUTCFullYear(),
    month: jst.getUTCMonth() + 1,
    day: jst.getUTCDate(),
  };
}

/**
 * 在籍・休会の生徒の学年を1つ上げる(退会は対象外)。
 * CASE式で一括更新するため、進級後の学年が連鎖的にさらに上がることはない。
 * @returns 更新した生徒数
 */
export async function promoteGrades(env: Env): Promise<number> {
  const cases = Object.entries(NEXT_GRADE)
    .map(([from, to]) => `WHEN '${from}' THEN '${to}'`)
    .join(" ");
  const inList = Object.keys(NEXT_GRADE)
    .map((g) => `'${g}'`)
    .join(", ");
  const res = await env.DB.prepare(
    `UPDATE students
       SET grade = CASE grade ${cases} ELSE grade END
     WHERE status != '退会' AND grade IN (${inList})`
  ).run();
  return res.meta.changes ?? 0;
}

/**
 * cronから呼ばれる。日本時間で4月1日、かつ当年まだ実行していなければ進級を実行する。
 * app_settings に実行済みの年を記録し、二重実行を防ぐ。
 */
export async function promoteGradesIfDue(env: Env, now: Date = new Date()): Promise<void> {
  const { year, month, day } = jstParts(now);
  if (month !== 4 || day !== 1) return;

  const lastRun = await getSetting(env, LAST_RUN_KEY, "");
  if (lastRun === String(year)) return;

  await promoteGrades(env);
  await setSetting(env, LAST_RUN_KEY, String(year));
}
