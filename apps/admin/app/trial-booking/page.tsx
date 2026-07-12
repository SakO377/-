"use client";

import { useState, type FormEvent } from "react";
import { API_BASE_URL } from "@/lib/api";

// ログイン不要の公開フォーム。体験・見学の申込を受け付け、
// 管理画面の「体験予約」に「問い合わせ」として届く。
export default function TrialBookingPage() {
  const [form, setForm] = useState({
    student_name: "",
    guardian_name: "",
    contact: "",
    desired_date: "",
    note: "",
  });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/trials/public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: form.student_name,
          guardian_name: form.guardian_name || null,
          contact: form.contact || null,
          desired_date: form.desired_date || null,
          note: form.note || null,
        }),
      });
      if (!res.ok) throw new Error("送信に失敗しました。時間をおいて再度お試しください。");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="mb-2 text-xl font-bold">送信しました</h1>
        <p className="text-sm text-gray-600">
          体験・見学のお申し込みありがとうございます。教室より折り返しご連絡いたします。
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-1 text-xl font-bold">体験・見学のお申し込み</h1>
      <p className="mb-4 text-sm text-gray-500">
        下記をご入力のうえ送信してください。折り返し教室よりご連絡します。
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-600">お子さまのお名前 *</label>
          <input
            className="rounded border px-3 py-2"
            value={form.student_name}
            onChange={(e) => setForm({ ...form, student_name: e.target.value })}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-600">保護者のお名前</label>
          <input
            className="rounded border px-3 py-2"
            value={form.guardian_name}
            onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-600">ご連絡先(電話番号・メールなど) *</label>
          <input
            className="rounded border px-3 py-2"
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-600">ご希望日(任意)</label>
          <input
            type="date"
            className="rounded border px-3 py-2"
            value={form.desired_date}
            onChange={(e) => setForm({ ...form, desired_date: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-600">ご要望・ご質問(任意)</label>
          <textarea
            className="rounded border px-3 py-2"
            rows={3}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "送信中..." : "送信する"}
        </button>
      </form>
    </main>
  );
}
