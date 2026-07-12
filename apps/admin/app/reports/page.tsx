"use client";

import { useEffect, useState, type FormEvent } from "react";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch } from "@/lib/api";
import type { Student } from "@school-harness/shared";

interface ReportTemplate {
  id: string;
  name: string;
  subject: string | null;
  body_template: string;
}

interface ReportRow {
  id: string;
  student_name: string;
  author: string | null;
  body: string;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

interface MissingStudent {
  id: string;
  name: string;
  grade: string | null;
}

interface StaffName {
  id: string;
  name: string;
}

function ReportsView() {
  const [students, setStudents] = useState<Student[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [missing, setMissing] = useState<MissingStudent[]>([]);
  const [staffNames, setStaffNames] = useState<StaffName[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [templateForm, setTemplateForm] = useState({ name: "", subject: "", body_template: "" });
  const [reportForm, setReportForm] = useState({
    student_id: "",
    template_id: "",
    author: "",
    body: "",
  });

  async function load() {
    try {
      const [studentsRes, templatesRes, reportsRes, missingRes, staffRes] = await Promise.all([
        apiFetch<{ students: Student[] }>("/api/students"),
        apiFetch<{ report_templates: ReportTemplate[] }>("/api/report-templates"),
        apiFetch<{ reports: ReportRow[] }>("/api/reports"),
        apiFetch<{ students: MissingStudent[] }>("/api/dashboard/reports-missing"),
        apiFetch<{ staff: StaffName[] }>("/api/staff/names"),
      ]);
      setStudents(studentsRes.students);
      setTemplates(templatesRes.report_templates);
      setReports(reportsRes.reports);
      setMissing(missingRes.students);
      setStaffNames(staffRes.staff);
      setReportForm((f) => (f.student_id ? f : { ...f, student_id: studentsRes.students[0]?.id ?? "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addTemplate(e: FormEvent) {
    e.preventDefault();
    await apiFetch("/api/report-templates", {
      method: "POST",
      body: JSON.stringify({
        name: templateForm.name,
        subject: templateForm.subject || null,
        body_template: templateForm.body_template,
      }),
    });
    setTemplateForm({ name: "", subject: "", body_template: "" });
    load();
  }

  function applyTemplate(templateId: string) {
    const template = templates.find((t) => t.id === templateId);
    setReportForm((f) => ({
      ...f,
      template_id: templateId,
      body: template ? template.body_template : f.body,
    }));
  }

  async function deleteTemplate(id: string) {
    if (!window.confirm("このテンプレートを削除しますか?")) return;
    await apiFetch(`/api/report-templates/${id}`, { method: "DELETE" });
    load();
  }

  async function createReport(e: FormEvent) {
    e.preventDefault();
    await apiFetch("/api/reports", {
      method: "POST",
      body: JSON.stringify({
        student_id: reportForm.student_id,
        template_id: reportForm.template_id || null,
        author: reportForm.author || null,
        body: reportForm.body,
      }),
    });
    setReportForm({ ...reportForm, body: "" });
    load();
  }

  async function sendReport(id: string) {
    await apiFetch(`/api/reports/${id}/send`, { method: "POST" });
    load();
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-bold">指導報告書</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {missing.length > 0 && (
        <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-1 font-semibold text-amber-900">
            今月まだ報告書がない生徒({missing.length}名)
          </h2>
          <p className="mb-2 text-sm text-amber-800">
            名前をタップすると、下の作成フォームにその生徒がセットされます。
          </p>
          <div className="flex flex-wrap gap-1">
            {missing.map((m) => (
              <button
                key={m.id}
                onClick={() => setReportForm((f) => ({ ...f, student_id: m.id }))}
                className="rounded-full border border-amber-300 bg-white px-2 py-1 text-xs hover:bg-amber-100"
              >
                {m.name}
                {m.grade ? <span className="text-gray-400"> {m.grade}</span> : null}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8 rounded-lg border bg-gray-50 p-4">
        <h2 className="mb-1 font-semibold">テンプレート(任意・最初に一度だけ用意)</h2>
        <p className="mb-1 text-sm text-gray-600">
          毎回ゼロから書かずに済むよう、「よく使う書き出し・項目」をひな形として登録しておく機能です。
          登録は任意で、使わなくても報告書は作成できます。
        </p>
        <p className="mb-3 text-sm text-gray-500">
          下の「報告書を作成」でテンプレートを選ぶと、その内容が本文欄に自動で入り、あとは空欄を埋めるだけで完成します。
        </p>

        {templates.length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-xs font-semibold text-gray-500">登録済みのテンプレート</p>
            <ul className="flex flex-wrap gap-2 text-sm">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded border bg-white px-2 py-1">
                  <span>
                    {t.name}
                    {t.subject ? <span className="text-gray-400"> / {t.subject}</span> : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteTemplate(t.id)}
                    className="text-gray-400 hover:text-red-600"
                    aria-label={`${t.name}を削除`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <details className="text-sm">
          <summary className="cursor-pointer text-blue-600">＋ 新しいテンプレートを登録する</summary>
          <form onSubmit={addTemplate} className="mt-3 flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <input
                className="rounded border px-3 py-2 text-sm"
                placeholder="テンプレート名(例: 通常授業レポート)"
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                required
              />
              <input
                className="rounded border px-3 py-2 text-sm"
                placeholder="教科(任意・例: 算数)"
                value={templateForm.subject}
                onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
              />
            </div>
            <textarea
              className="rounded border px-3 py-2 text-sm"
              rows={5}
              placeholder={"本文のひな形(例)\n本日の単元: \n理解度: \n宿題: \n次回までの目標: "}
              value={templateForm.body_template}
              onChange={(e) => setTemplateForm({ ...templateForm, body_template: e.target.value })}
              required
            />
            <button type="submit" className="self-start rounded bg-black px-3 py-2 text-sm text-white">
              このテンプレートを登録
            </button>
          </form>
        </details>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 font-semibold">報告書を作成</h2>
        <form onSubmit={createReport} className="flex flex-col gap-3">
          <select
            className="rounded border px-3 py-2"
            value={reportForm.student_id}
            onChange={(e) => setReportForm({ ...reportForm, student_id: e.target.value })}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {templates.length > 0 && (
            <div className="flex flex-col gap-1">
              <select
                className="rounded border px-3 py-2"
                value={reportForm.template_id}
                onChange={(e) => applyTemplate(e.target.value)}
              >
                <option value="">テンプレートを使わない</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.subject ? ` / ${t.subject}` : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                選ぶと下の本文に定型文が入ります。そのまま書き換えて使えます。
              </p>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-600">担当講師</label>
            {staffNames.length > 0 ? (
              <select
                className="rounded border px-3 py-2"
                value={reportForm.author}
                onChange={(e) => setReportForm({ ...reportForm, author: e.target.value })}
              >
                <option value="">選択してください</option>
                {staffNames.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="rounded border px-3 py-2"
                placeholder="担当講師名"
                value={reportForm.author}
                onChange={(e) => setReportForm({ ...reportForm, author: e.target.value })}
              />
            )}
          </div>
          <textarea
            className="rounded border px-3 py-2"
            rows={4}
            placeholder="本文"
            value={reportForm.body}
            onChange={(e) => setReportForm({ ...reportForm, body: e.target.value })}
            required
          />
          <button type="submit" className="rounded bg-black px-4 py-2 text-white">
            下書きを作成
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">報告書一覧</h2>
        {reports.length === 0 && <p className="text-sm text-gray-500">まだ報告書がありません。</p>}
        {reports.length > 0 && (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">生徒</th>
                <th className="py-2">講師</th>
                <th className="py-2">作成日</th>
                <th className="py-2">状態</th>
                <th className="py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b align-top">
                  <td className="py-2">{r.student_name}</td>
                  <td className="py-2">{r.author ?? "-"}</td>
                  <td className="py-2">{r.created_at}</td>
                  <td className="py-2">{r.sent_at ? "送信済み" : "未送信"}</td>
                  <td className="py-2">
                    {!r.sent_at && (
                      <button
                        onClick={() => sendReport(r.id)}
                        className="rounded bg-black px-2 py-1 text-xs text-white"
                      >
                        LINEで送信
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

export default function ReportsPage() {
  return (
    <AuthGuard>
      <NavBar />
      <ReportsView />
    </AuthGuard>
  );
}
