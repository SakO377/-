"use client";

import { Suspense, useEffect, useState, useCallback, type KeyboardEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch } from "@/lib/api";
import type { StudentStatus } from "@school-harness/shared";

const GRADE_PRESETS = [
  "年少",
  "年中",
  "年長",
  "小1",
  "小2",
  "小3",
  "小4",
  "小5",
  "小6",
  "中1",
  "中2",
  "中3",
  "高1",
  "高2",
  "高3",
];
const GRADE_CUSTOM = "__custom__";

interface StudentDetail {
  id: string;
  name: string;
  grade: string | null;
  course: string | null;
  status: StudentStatus;
  tags: string[];
  qr_token: string | null;
  monthly_fee: number | null;
  guardians: {
    id: string;
    name: string | null;
    line_user_id: string | null;
    relation: string | null;
  }[];
}

interface InviteCodeResult {
  code: string;
  expires_at: string;
}

const STATUSES: StudentStatus[] = ["在籍", "休会", "退会"];

type TabKey = "attendance" | "absences" | "reports" | "invoices";

const TABS: { key: TabKey; label: string }[] = [
  { key: "attendance", label: "入退室" },
  { key: "absences", label: "欠席・振替" },
  { key: "reports", label: "指導報告書" },
  { key: "invoices", label: "請求" },
];

interface AttendanceRow {
  id: string;
  type: "check_in" | "check_out";
  timestamp: string;
  notified_at: string | null;
}

interface AbsenceRow {
  id: string;
  date: string;
  reason: string | null;
  status: string;
  makeup_date: string | null;
}

interface ReportRow {
  id: string;
  author: string | null;
  body: string;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

interface InvoiceRow {
  id: string;
  year_month: string;
  total: number;
  paid_status: string;
  sent_at: string | null;
}

function HistoryTabs({ studentId }: { studentId: string }) {
  const [tab, setTab] = useState<TabKey>("attendance");
  const [attendance, setAttendance] = useState<AttendanceRow[] | null>(null);
  const [absences, setAbsences] = useState<AbsenceRow[] | null>(null);
  const [reports, setReports] = useState<ReportRow[] | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);

  useEffect(() => {
    const query = `student_id=${encodeURIComponent(studentId)}`;
    if (tab === "attendance" && attendance === null) {
      apiFetch<{ attendance: AttendanceRow[] }>(`/api/attendance?${query}`).then((res) =>
        setAttendance(res.attendance)
      );
    }
    if (tab === "absences" && absences === null) {
      apiFetch<{ absences: AbsenceRow[] }>(`/api/absences?${query}`).then((res) =>
        setAbsences(res.absences)
      );
    }
    if (tab === "reports" && reports === null) {
      apiFetch<{ reports: ReportRow[] }>(`/api/reports?${query}`).then((res) =>
        setReports(res.reports)
      );
    }
    if (tab === "invoices" && invoices === null) {
      apiFetch<{ invoices: InvoiceRow[] }>(`/api/invoices?${query}`).then((res) =>
        setInvoices(res.invoices)
      );
    }
  }, [tab, studentId, attendance, absences, reports, invoices]);

  function empty(rows: unknown[] | null, message: string) {
    if (rows === null) return <p className="py-3 text-sm text-gray-500">読み込み中...</p>;
    if (rows.length === 0) return <p className="py-3 text-sm text-gray-500">{message}</p>;
    return null;
  }

  return (
    <section className="mb-6">
      <h2 className="mb-2 font-semibold">履歴</h2>
      <div className="mb-2 flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-sm ${
              tab === t.key
                ? "border-b-2 border-black font-bold"
                : "text-gray-500 hover:text-black"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "attendance" && (
        <>
          {empty(attendance, "入退室の記録はまだありません。")}
          {attendance && attendance.length > 0 && (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-1.5">日時</th>
                  <th className="py-1.5">種別</th>
                  <th className="py-1.5">通知</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="py-1.5">{r.timestamp}</td>
                    <td className="py-1.5">{r.type === "check_in" ? "入室" : "退室"}</td>
                    <td className="py-1.5">{r.notified_at ? "通知済み" : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {tab === "absences" && (
        <>
          {empty(absences, "欠席・振替の連絡はまだありません。")}
          {absences && absences.length > 0 && (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-1.5">欠席日</th>
                  <th className="py-1.5">理由</th>
                  <th className="py-1.5">ステータス</th>
                  <th className="py-1.5">振替日</th>
                </tr>
              </thead>
              <tbody>
                {absences.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="py-1.5">{r.date}</td>
                    <td className="py-1.5">{r.reason ?? "-"}</td>
                    <td className="py-1.5">{r.status}</td>
                    <td className="py-1.5">{r.makeup_date ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {tab === "reports" && (
        <>
          {empty(reports, "指導報告書はまだありません。")}
          {reports && reports.length > 0 && (
            <ul className="flex flex-col gap-2">
              {reports.map((r) => (
                <li key={r.id} className="rounded border p-3 text-sm">
                  <p className="mb-1 text-xs text-gray-500">
                    {r.created_at}
                    {r.author ? ` / ${r.author}` : ""} /{" "}
                    {r.sent_at ? (r.read_at ? "既読" : "送信済み・未読") : "未送信"}
                  </p>
                  <p className="whitespace-pre-wrap">{r.body}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "invoices" && (
        <>
          {empty(invoices, "請求書はまだありません。")}
          {invoices && invoices.length > 0 && (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-1.5">対象月</th>
                  <th className="py-1.5">金額</th>
                  <th className="py-1.5">入金</th>
                  <th className="py-1.5">送信</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="py-1.5">{r.year_month}</td>
                    <td className="py-1.5">¥{r.total.toLocaleString("ja-JP")}</td>
                    <td className="py-1.5">{r.paid_status}</td>
                    <td className="py-1.5">{r.sent_at ? "送信済み" : "未送信"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}

function StudentDetailView() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("id") ?? "";
  const router = useRouter();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteCodeResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [monthlyFeeInput, setMonthlyFeeInput] = useState("");
  const [basicForm, setBasicForm] = useState({ name: "", grade: "", course: "" });
  const [gradeMode, setGradeMode] = useState<"preset" | typeof GRADE_CUSTOM>("preset");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [basicSaved, setBasicSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<StudentDetail>(`/api/students/${studentId}`);
      setStudent(res);
      setMonthlyFeeInput(res.monthly_fee != null ? String(res.monthly_fee) : "");
      setBasicForm({ name: res.name, grade: res.grade ?? "", course: res.course ?? "" });
      setGradeMode(
        res.grade && !GRADE_PRESETS.includes(res.grade) ? GRADE_CUSTOM : "preset"
      );
      setTags(res.tags);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    }
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!student?.qr_token) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(student.qr_token, { width: 200 }).then(setQrDataUrl);
  }, [student?.qr_token]);

  async function updateStatus(status: StudentStatus) {
    if (!student) return;
    await apiFetch(`/api/students/${student.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setStudent({ ...student, status });
  }

  async function handleDelete() {
    if (!student) return;
    if (!confirm(`${student.name} を削除しますか?関連する出欠・報告書等もすべて削除されます。`)) return;
    await apiFetch(`/api/students/${student.id}`, { method: "DELETE" });
    router.push("/students");
  }

  async function issueInvite() {
    if (!student) return;
    const res = await apiFetch<InviteCodeResult>(`/api/students/${student.id}/invite-codes`, {
      method: "POST",
    });
    setInvite(res);
  }

  async function saveMonthlyFee() {
    if (!student) return;
    const monthly_fee = monthlyFeeInput === "" ? null : Number(monthlyFeeInput);
    const res = await apiFetch<StudentDetail>(`/api/students/${student.id}`, {
      method: "PATCH",
      body: JSON.stringify({ monthly_fee }),
    });
    setStudent({ ...student, monthly_fee: res.monthly_fee });
  }

  function addTag() {
    const value = tagInput.trim();
    if (!value || tags.includes(value)) {
      setTagInput("");
      return;
    }
    setTags([...tags, value]);
    setTagInput("");
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  }

  async function saveBasic() {
    if (!student) return;
    setBasicSaved(false);
    const res = await apiFetch<StudentDetail>(`/api/students/${student.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: basicForm.name,
        grade: basicForm.grade || null,
        course: basicForm.course || null,
        tags,
      }),
    });
    setStudent({ ...student, name: res.name, grade: res.grade, course: res.course, tags: res.tags });
    setBasicSaved(true);
  }

  async function regenerateQr() {
    if (!student) return;
    if (
      student.qr_token &&
      !confirm("QRコードを再発行すると、これまで印刷したQRカードは使えなくなります。よろしいですか?")
    )
      return;
    const res = await apiFetch<{ qr_token: string }>(`/api/students/${student.id}/qr-token`, {
      method: "POST",
    });
    setStudent({ ...student, qr_token: res.qr_token });
  }

  if (error) return <main className="p-6 text-red-600">{error}</main>;
  if (!student) return <main className="p-6 text-gray-500">読み込み中...</main>;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-bold">{student.name}</h1>
      <p className="mb-4 text-sm text-gray-500">
        {student.grade ?? "-"} / {student.course ?? "-"}
      </p>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">基本情報</h2>
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-600">氏名</label>
            <input
              className="rounded border px-3 py-2"
              value={basicForm.name}
              onChange={(e) => setBasicForm({ ...basicForm, name: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-600">学年</label>
            <select
              className="rounded border px-3 py-2"
              value={gradeMode === GRADE_CUSTOM ? GRADE_CUSTOM : basicForm.grade}
              onChange={(e) => {
                if (e.target.value === GRADE_CUSTOM) {
                  setGradeMode(GRADE_CUSTOM);
                  setBasicForm({ ...basicForm, grade: "" });
                } else {
                  setGradeMode("preset");
                  setBasicForm({ ...basicForm, grade: e.target.value });
                }
              }}
            >
              <option value="">選択してください</option>
              {GRADE_PRESETS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
              <option value={GRADE_CUSTOM}>その他(自由入力)</option>
            </select>
            {gradeMode === GRADE_CUSTOM && (
              <input
                className="rounded border px-3 py-2"
                placeholder="学年を入力(例: 高卒認定クラス)"
                value={basicForm.grade}
                onChange={(e) => setBasicForm({ ...basicForm, grade: e.target.value })}
              />
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-600">コース</label>
            <input
              className="rounded border px-3 py-2"
              value={basicForm.course}
              onChange={(e) => setBasicForm({ ...basicForm, course: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-600">タグ</label>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                      className="text-gray-500 hover:text-red-600"
                      aria-label={`${tag}を削除`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                className="flex-1 rounded border px-3 py-2 text-sm"
                placeholder="タグを入力してEnter(例: 兄弟在籍、体験)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
              />
              <button
                type="button"
                onClick={addTag}
                className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
              >
                追加
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={saveBasic}
              className="self-start rounded bg-black px-4 py-2 text-sm text-white"
            >
              基本情報を保存
            </button>
            {basicSaved && <span className="text-sm text-green-600">保存しました</span>}
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">ステータス</h2>
        <div className="flex gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => updateStatus(s)}
              className={`rounded px-3 py-1.5 text-sm ${
                student.status === s ? "bg-black text-white" : "bg-gray-100"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">保護者</h2>
        {student.guardians.length === 0 ? (
          <p className="text-sm text-gray-500">まだ保護者が紐付けられていません。</p>
        ) : (
          <ul className="mb-3 text-sm">
            {student.guardians.map((g) => (
              <li key={g.id}>
                {g.name ?? "(LINE連携済・未設定)"} {g.relation ? `(${g.relation})` : ""}
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={issueInvite}
          className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          招待コードを発行する
        </button>
        {invite && (
          <div className="mt-3 rounded bg-gray-100 p-3 text-sm">
            <p>
              招待コード: <code className="font-bold">{invite.code}</code>
            </p>
            <p className="text-gray-500">
              有効期限: {new Date(invite.expires_at).toLocaleString("ja-JP")}
            </p>
            <p className="mt-1 text-gray-500">
              保護者にLINE公式アカウントを友だち追加してもらい、LIFFの紐付け画面でこのコードを入力してもらってください。
            </p>
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">月謝</h2>
        <div className="flex items-center gap-2">
          <span>¥</span>
          <input
            type="number"
            step="100"
            className="w-32 rounded border px-3 py-2 text-sm"
            value={monthlyFeeInput}
            onChange={(e) => setMonthlyFeeInput(e.target.value)}
            placeholder="未設定"
          />
          <button
            onClick={saveMonthlyFee}
            className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            保存
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          請求書作成時にこの金額が「月謝」項目として自動入力されます(兄弟割引等はその都度手動調整)。
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">入退室QRコード</h2>
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="入退室QRコード" width={160} height={160} />
        ) : (
          <p className="text-sm text-gray-500">QRコードがまだ発行されていません。</p>
        )}
        <button
          onClick={regenerateQr}
          className="mt-2 rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          {student.qr_token ? "QRコードを再発行する" : "QRコードを発行する"}
        </button>
        <p className="mt-1 text-sm text-gray-500">
          印刷してカードにし、教室のQRリーダー画面(<code>/kiosk</code>)で読み取ってもらってください。
        </p>
      </section>

      <HistoryTabs studentId={student.id} />

      <button onClick={handleDelete} className="text-sm text-red-600 hover:underline">
        この生徒を削除する
      </button>
    </main>
  );
}

export default function StudentDetailPage() {
  return (
    <AuthGuard>
      <NavBar />
      <Suspense fallback={<main className="p-6 text-gray-500">読み込み中...</main>}>
        <StudentDetailView />
      </Suspense>
    </AuthGuard>
  );
}
