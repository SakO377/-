"use client";

import { useEffect, useState, type FormEvent } from "react";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch } from "@/lib/api";
import type { Student } from "@school-harness/shared";

type ReferralStatus = "紹介受付" | "体験" | "入会" | "特典付与済" | "見送り";
const STATUSES: ReferralStatus[] = ["紹介受付", "体験", "入会", "特典付与済", "見送り"];

interface ReferralRow {
  id: string;
  referrer_student_id: string | null;
  referrer_student_name: string | null;
  referrer_name: string | null;
  referee_name: string;
  status: ReferralStatus;
  reward_note: string | null;
  created_at: string;
}

const STATUS_STYLE: Record<ReferralStatus, string> = {
  紹介受付: "bg-yellow-100 text-yellow-800",
  体験: "bg-purple-100 text-purple-800",
  入会: "bg-green-100 text-green-800",
  特典付与済: "bg-blue-100 text-blue-800",
  見送り: "bg-gray-200 text-gray-600",
};

function ReferralsView() {
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    referrer_student_id: "",
    referrer_name: "",
    referee_name: "",
    reward_note: "",
  });

  async function load() {
    try {
      const [refRes, studentsRes] = await Promise.all([
        apiFetch<{ referrals: ReferralRow[] }>("/api/referrals"),
        apiFetch<{ students: Student[] }>("/api/students"),
      ]);
      setReferrals(refRes.referrals);
      setStudents(studentsRes.students);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addReferral(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch("/api/referrals", {
        method: "POST",
        body: JSON.stringify({
          referrer_student_id: form.referrer_student_id || null,
          referrer_name: form.referrer_name || null,
          referee_name: form.referee_name,
          reward_note: form.reward_note || null,
        }),
      });
      setForm({ referrer_student_id: "", referrer_name: "", referee_name: "", reward_note: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    }
  }

  async function updateStatus(id: string, status: ReferralStatus) {
    await apiFetch(`/api/referrals/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
  }

  async function remove(id: string) {
    if (!window.confirm("この紹介を削除しますか?")) return;
    await apiFetch(`/api/referrals/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-1 text-xl font-bold">口コミ・紹介</h1>
      <p className="mb-4 text-sm text-gray-500">
        在籍生徒からの紹介を記録し、体験→入会→特典付与まで進捗を管理します。
      </p>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <section className="mb-8">
        <h2 className="mb-2 font-semibold">紹介を追加</h2>
        <form onSubmit={addReferral} className="flex flex-wrap gap-2">
          <select
            className="rounded border px-3 py-2 text-sm"
            value={form.referrer_student_id}
            onChange={(e) => setForm({ ...form, referrer_student_id: e.target.value })}
          >
            <option value="">紹介元(在籍生徒・任意)</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="紹介元の名前(在籍外の場合)"
            value={form.referrer_name}
            onChange={(e) => setForm({ ...form, referrer_name: e.target.value })}
          />
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="紹介されたお子さまの名前 *"
            value={form.referee_name}
            onChange={(e) => setForm({ ...form, referee_name: e.target.value })}
            required
          />
          <input
            className="min-w-[160px] flex-1 rounded border px-3 py-2 text-sm"
            placeholder="特典メモ(例: 紹介者に1ヶ月分割引)"
            value={form.reward_note}
            onChange={(e) => setForm({ ...form, reward_note: e.target.value })}
          />
          <button type="submit" className="rounded bg-black px-3 py-2 text-sm text-white">
            追加
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">紹介一覧</h2>
        {referrals.length === 0 && <p className="text-sm text-gray-500">まだ紹介がありません。</p>}
        {referrals.length > 0 && (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">紹介元</th>
                <th className="py-2">紹介された子</th>
                <th className="py-2">特典</th>
                <th className="py-2">状況</th>
                <th className="py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id} className="border-b align-top">
                  <td className="py-2">{r.referrer_student_name ?? r.referrer_name ?? "-"}</td>
                  <td className="py-2">{r.referee_name}</td>
                  <td className="py-2 text-gray-500">{r.reward_note ?? "-"}</td>
                  <td className="py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2">
                    <div className="flex flex-col gap-1">
                      <select
                        className="rounded border px-2 py-1 text-xs"
                        value={r.status}
                        onChange={(e) => updateStatus(r.id, e.target.value as ReferralStatus)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}に変更
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => remove(r.id)}
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

export default function ReferralsPage() {
  return (
    <AuthGuard>
      <NavBar />
      <ReferralsView />
    </AuthGuard>
  );
}
