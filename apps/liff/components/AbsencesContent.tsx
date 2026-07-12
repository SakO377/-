"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLiff } from "@/lib/useLiff";
import { apiFetch, ApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import NotLinkedNotice from "@/components/NotLinkedNotice";
import type { AbsenceStatus } from "@school-harness/shared";

interface GuardianStudent {
  id: string;
  name: string;
}

interface AbsenceRow {
  id: string;
  student_name: string;
  date: string;
  reason: string | null;
  status: AbsenceStatus;
  makeup_date: string | null;
}

export default function AbsencesContent({
  onBack,
  onGoToLink,
}: {
  onBack: () => void;
  onGoToLink: () => void;
}) {
  const { status, error: liffError, liff } = useLiff();
  const [students, setStudents] = useState<GuardianStudent[]>([]);
  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [form, setForm] = useState({ student_id: "", date: "", reason: "" });
  const [error, setError] = useState<string | null>(null);
  const [notLinked, setNotLinked] = useState(false);
  const [loading, setLoading] = useState(false);

  const authHeader = useCallback((): Record<string, string> => {
    const idToken = liff.getIDToken();
    return idToken ? { Authorization: `Bearer ${idToken}` } : {};
  }, [liff]);

  const load = useCallback(async () => {
    try {
      const me = await apiFetch<{ students: GuardianStudent[] }>("/liff/me", {
        headers: authHeader(),
      });
      setStudents(me.students);
      setForm((f) => (f.student_id ? f : { ...f, student_id: me.students[0]?.id ?? "" }));
      const res = await apiFetch<{ absences: AbsenceRow[] }>("/liff/absences", {
        headers: authHeader(),
      });
      setAbsences(res.absences);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 401)) {
        setNotLinked(true);
        return;
      }
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    }
  }, [authHeader]);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/liff/absences", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          student_id: form.student_id,
          date: form.date,
          reason: form.reason || null,
        }),
      });
      setForm({ ...form, date: "", reason: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function confirmMakeup(id: string) {
    await apiFetch(`/liff/absences/${id}/confirm`, { method: "POST", headers: authHeader() });
    load();
  }

  if (status === "initializing") {
    return <p className="text-center text-gray-500">読み込み中...</p>;
  }
  if (status === "error") {
    return <p className="text-center text-red-600">{liffError}</p>;
  }
  if (notLinked) {
    return (
      <div>
        <PageHeader title="欠席・振替連絡" onBack={onBack} />
        <NotLinkedNotice onGoToLink={onGoToLink} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader title="欠席・振替連絡" onBack={onBack} />
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        {students.length === 0 ? (
          <p className="text-sm text-gray-500">
            まだお子さまとの連携が完了していません。教室から受け取った招待コードで連携してください。
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <select
              className="rounded border px-3 py-2"
              value={form.student_id}
              onChange={(e) => setForm({ ...form, student_id: e.target.value })}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="rounded border px-3 py-2"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
            <textarea
              className="rounded border px-3 py-2"
              placeholder="理由(任意)"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              {loading ? "送信中..." : "欠席を連絡する"}
            </button>
          </form>
        )}
      </div>

      {absences.length > 0 && (
        <div>
          <h2 className="mb-2 font-semibold">連絡履歴</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {absences.map((a) => (
              <li key={a.id} className="rounded border p-3">
                <p>
                  {a.student_name} / {a.date} / {a.status}
                </p>
                {a.reason && <p className="text-gray-500">理由: {a.reason}</p>}
                {a.makeup_date && <p className="text-gray-500">振替候補日: {a.makeup_date}</p>}
                {a.status === "振替提案" && (
                  <button
                    onClick={() => confirmMakeup(a.id)}
                    className="mt-2 rounded bg-black px-3 py-1 text-xs text-white"
                  >
                    この振替日で確定する
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
