import type { Env } from "../types";
import { generateId, generateApiKey, generateQrToken } from "./id";

// 体験用デモ環境に見本データを投入する。
// staff が空のときだけ実行され、デモ用オーナーのAPIキーを返す。
// 実運用の初期化(/api/setup/init)とは独立しており、DEMO_MODE時のみ呼ばれる。
export async function seedDemoData(env: Env): Promise<string> {
  const db = env.DB;
  const apiKey = generateApiKey();
  const ownerId = generateId("staff");

  const c1 = generateId("class");
  const c2 = generateId("class");
  const c3 = generateId("class");

  const students = [
    { id: generateId("student"), name: "山田 太郎", grade: "小3", course: "算数", class_id: c1, fee: 8800, tags: ["兄弟在籍"] },
    { id: generateId("student"), name: "山田 花子", grade: "小1", course: "算数", class_id: c1, fee: 8800, tags: ["兄弟在籍"] },
    { id: generateId("student"), name: "佐藤 健", grade: "中2", course: "英語", class_id: c2, fee: 12000, tags: [] },
    { id: generateId("student"), name: "高橋 美咲", grade: "中1", course: "英語", class_id: c2, fee: 12000, tags: ["体験"] },
    { id: generateId("student"), name: "田中 陽菜", grade: "年長", course: "そろばん", class_id: c3, fee: 6000, tags: [] },
  ];

  const statements: D1PreparedStatement[] = [
    db.prepare("INSERT INTO staff (id, name, role, api_key) VALUES (?, ?, 'owner', ?)").bind(
      ownerId,
      "デモ教室 管理者",
      apiKey
    ),
    db.prepare("INSERT INTO classes (id, name, weekday, start_time, end_time, capacity) VALUES (?, ?, ?, ?, ?, ?)").bind(c1, "小学生 算数クラス", 1, "16:30", "17:30", 12),
    db.prepare("INSERT INTO classes (id, name, weekday, start_time, end_time, capacity) VALUES (?, ?, ?, ?, ?, ?)").bind(c2, "中学生 英語クラス", 3, "18:00", "19:30", 10),
    db.prepare("INSERT INTO classes (id, name, weekday, start_time, end_time, capacity) VALUES (?, ?, ?, ?, ?, ?)").bind(c3, "そろばん教室", 6, "10:00", "11:00", 15),
  ];

  for (const s of students) {
    statements.push(
      db
        .prepare(
          "INSERT INTO students (id, name, grade, course, class_id, status, tags, metadata, qr_token, monthly_fee) VALUES (?, ?, ?, ?, ?, '在籍', ?, '{}', ?, ?)"
        )
        .bind(s.id, s.name, s.grade, s.course, s.class_id, JSON.stringify(s.tags), generateQrToken(), s.fee)
    );
  }

  // 入退室ログ(山田太郎: 入室→退室、佐藤健: 入室)
  statements.push(
    db.prepare("INSERT INTO attendance_logs (id, student_id, type) VALUES (?, ?, 'check_in')").bind(generateId("attendance"), students[0].id),
    db.prepare("INSERT INTO attendance_logs (id, student_id, type) VALUES (?, ?, 'check_out')").bind(generateId("attendance"), students[0].id),
    db.prepare("INSERT INTO attendance_logs (id, student_id, type) VALUES (?, ?, 'check_in')").bind(generateId("attendance"), students[2].id)
  );

  // 欠席・振替(佐藤健: 振替提案中、山田花子: 申請中)
  const absence1 = generateId("absence");
  statements.push(
    db.prepare("INSERT INTO absence_requests (id, student_id, class_id, date, reason, status, makeup_date) VALUES (?, ?, ?, ?, ?, '振替提案', ?)").bind(absence1, students[2].id, c2, "2026-07-15", "学校行事のため", "2026-07-18"),
    db.prepare("INSERT INTO absence_requests (id, student_id, class_id, date, reason, status, makeup_date) VALUES (?, ?, ?, ?, ?, '申請', NULL)").bind(generateId("absence"), students[1].id, c1, "2026-07-14", "発熱のため")
  );

  // 指導報告書(山田太郎: 送信済み、佐藤健: 未送信の下書き)
  statements.push(
    db.prepare("INSERT INTO report_templates (id, name, subject, body_template) VALUES (?, ?, ?, ?)").bind(generateId("template"), "算数(標準)", "算数", "本日の単元: \n理解度: \n宿題: "),
    db.prepare("INSERT INTO reports (id, student_id, author, body, sent_at) VALUES (?, ?, ?, ?, datetime('now'))").bind(generateId("report"), students[0].id, "鈴木先生", "本日の単元: 分数のたし算\n理解度: よくできました。つまずきなく進められています。\n宿題: ドリルP.24-25"),
    db.prepare("INSERT INTO reports (id, student_id, author, body, sent_at) VALUES (?, ?, ?, ?, NULL)").bind(generateId("report"), students[2].id, "鈴木先生", "本日の単元: 不定詞\n理解度: to+動詞の原形の用法を確認しました。\n宿題: ワークP.40")
  );

  // お知らせ(送信済み全体・クラス別、予約配信1件)
  statements.push(
    db.prepare("INSERT INTO announcements (id, title, body, segment, sent_at) VALUES (?, ?, ?, ?, datetime('now'))").bind(generateId("announcement"), "夏期講習のご案内", "7月22日(水)より夏期講習を開始します。お申し込みは7月18日までにお願いします。", JSON.stringify({ type: "all" })),
    db.prepare("INSERT INTO announcements (id, title, body, segment, sent_at) VALUES (?, ?, ?, ?, datetime('now'))").bind(generateId("announcement"), "算数クラス 教室変更のお知らせ", "来週の算数クラスは2階の教室で行います。", JSON.stringify({ type: "class", class_id: c1 })),
    db.prepare("INSERT INTO announcements (id, title, body, segment, scheduled_at) VALUES (?, ?, ?, ?, ?)").bind(generateId("announcement"), "8月の休講日について", "8月13日〜15日はお盆休みのため休講です。", JSON.stringify({ type: "all" }), "2026-07-25T09:00:00Z")
  );

  // 請求書(山田太郎: 入金済、佐藤健: 未入金)
  statements.push(
    db.prepare("INSERT INTO invoices (id, student_id, year_month, items, total, paid_status, paid_at) VALUES (?, ?, ?, ?, ?, '入金済', datetime('now'))").bind(generateId("invoice"), students[0].id, "2026-07", JSON.stringify([{ label: "月謝(算数)", amount: 8800 }, { label: "教材費", amount: 1200 }, { label: "兄弟割引", amount: -500 }]), 9500),
    db.prepare("INSERT INTO invoices (id, student_id, year_month, items, total, paid_status) VALUES (?, ?, ?, ?, ?, '未入金')").bind(generateId("invoice"), students[2].id, "2026-07", JSON.stringify([{ label: "月謝(英語)", amount: 12000 }]), 12000)
  );

  await db.batch(statements);
  return apiKey;
}
