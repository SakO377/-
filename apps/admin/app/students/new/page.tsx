"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch } from "@/lib/api";

function NewStudentForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", grade: "", course: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const student = await apiFetch<{ id: string }>("/api/students", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          grade: form.grade || null,
          course: form.course || null,
        }),
      });
      router.push(`/students/${student.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-xl font-bold">生徒の新規登録</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          className="rounded border px-3 py-2"
          placeholder="氏名"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          className="rounded border px-3 py-2"
          placeholder="学年(例: 小3)"
          value={form.grade}
          onChange={(e) => setForm({ ...form, grade: e.target.value })}
        />
        <input
          className="rounded border px-3 py-2"
          placeholder="コース"
          value={form.course}
          onChange={(e) => setForm({ ...form, course: e.target.value })}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "登録中..." : "登録する"}
        </button>
      </form>
    </main>
  );
}

export default function NewStudentPage() {
  return (
    <AuthGuard>
      <NavBar />
      <NewStudentForm />
    </AuthGuard>
  );
}
