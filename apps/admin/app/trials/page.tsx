"use client";

import { useEffect, useState, type FormEvent } from "react";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import type { ClassEntity } from "@school-harness/shared";

type TrialStatus = "問い合わせ" | "予約確定" | "体験実施" | "入会" | "見送り";
const STATUSES: TrialStatus[] = ["問い合わせ", "予約確定", "体験実施", "入会", "見送り"];

interface TrialRow {
  id: string;
  student_name: string;
  guardian_name: string | null;
  contact: string | null;
  desired_date: string | null;
  class_id: string | null;
  class_name: string | null;
  status: TrialStatus;
  note: string | null;
  created_at: string;
}

const STATUS_STYLE: Record<TrialStatus, string> = {
  問い合わせ: "bg-yellow-100 text-yellow-800",
  予約確定: "bg-blue-100 text-blue-800",
  体験実施: "bg-purple-100 text-purple-800",
  入会: "bg-green-100 text-green-800",
  見送り: "bg-gray-200 text-gray-600",
};

function TrialsView() {
  const [trials, setTrials] = useState<TrialRow[]>([]);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    student_name: "",
    guardian_name: "",
    contact: "",
    desired_date: "",
    class_id: "",
    note: "",
  });

  async function load() {
    try {
      const [trialsRes, classesRes] = await Promise.all([
        apiFetch<{ trials: TrialRow[] }>("/api/trials"),
        apiFetch<{ classes: ClassEntity[] }>("/api/classes"),
      ]);
      setTrials(trialsRes.trials);
      setClasses(classesRes.classes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addTrial(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch("/api/trials", {
        method: "POST",
        body: JSON.stringify({
          student_name: form.student_name,
          guardian_name: form.guardian_name || null,
          contact: form.contact || null,
          desired_date: form.desired_date || null,
          class_id: form.class_id || null,
          note: form.note || null,
        }),
      });
      setForm({ student_name: "", guardian_name: "", contact: "", desired_date: "", class_id: "", note: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    }
  }

  async function updateStatus(id: string, status: TrialStatus) {
    await apiFetch(`/api/trials/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
  }

  async function remove(id: string) {
    if (!window.confirm("この体験予約を削除しますか?")) return;
    await apiFetch(`/api/trials/${id}`, { method: "DELETE" });
    load();
  }

  const bookingUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/trial-booking`;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-2 text-xl font-bold">体験・見学の予約(見込み客)</h1>
      <div className="mb-4 rounded-lg border bg-gray-50 p-3 text-sm text-gray-600">
        保護者に配れる公開申込フォーム:
        <a href="/trial-booking" target="_blank" className="ml-1 text-blue-600 hover:underline">
          {bookingUrl}
        </a>
        <span className="ml-1 text-gray-400">(ログイン不要。申込は「問い合わせ」として届きます)</span>
        <p className="mt-1 text-xs text-gray-400">
          ※申込フォームはAPI({API_BASE_URL})へ送信されます。
        </p>
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <section className="mb-8">
        <h2 className="mb-2 font-semibold">手動で追加(電話・来訪の記録など)</h2>
        <form onSubmit={addTrial} className="flex flex-wrap gap-2">
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="お子さまのお名前"
            value={form.student_name}
            onChange={(e) => setForm({ ...form, student_name: e.target.value })}
            required
          />
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="保護者名(任意)"
            value={form.guardian_name}
            onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
          />
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="連絡先(電話/メール等)"
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
          />
          <input
            type="date"
            className="rounded border px-3 py-2 text-sm"
            value={form.desired_date}
            onChange={(e) => setForm({ ...form, desired_date: e.target.value })}
          />
          <select
            className="rounded border px-3 py-2 text-sm"
            value={form.class_id}
            onChange={(e) => setForm({ ...form, class_id: e.target.value })}
          >
            <option value="">希望クラス(任意)</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            className="min-w-[160px] flex-1 rounded border px-3 py-2 text-sm"
            placeholder="メモ(任意)"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          <button type="submit" className="rounded bg-black px-3 py-2 text-sm text-white">
            追加
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">予約・問い合わせ一覧</h2>
        {trials.length === 0 && <p className="text-sm text-gray-500">まだ申込はありません。</p>}
        {trials.length > 0 && (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">お子さま</th>
                <th className="py-2">連絡先</th>
                <th className="py-2">希望日</th>
                <th className="py-2">希望クラス</th>
                <th className="py-2">状況</th>
                <th className="py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {trials.map((t) => (
                <tr key={t.id} className="border-b align-top">
                  <td className="py-2">
                    {t.student_name}
                    {t.guardian_name ? (
                      <span className="block text-xs text-gray-400">保護者: {t.guardian_name}</span>
                    ) : null}
                    {t.note ? <span className="block text-xs text-gray-400">{t.note}</span> : null}
                  </td>
                  <td className="py-2">{t.contact ?? "-"}</td>
                  <td className="py-2">{t.desired_date ?? "-"}</td>
                  <td className="py-2">{t.class_name ?? "-"}</td>
                  <td className="py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[t.status]}`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="py-2">
                    <div className="flex flex-col gap-1">
                      <select
                        className="rounded border px-2 py-1 text-xs"
                        value={t.status}
                        onChange={(e) => updateStatus(t.id, e.target.value as TrialStatus)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}に変更
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => remove(t.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        削除
                      </button>
                    </div>
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

export default function TrialsPage() {
  return (
    <AuthGuard>
      <NavBar />
      <TrialsView />
    </AuthGuard>
  );
}
