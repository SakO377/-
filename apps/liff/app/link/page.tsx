"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useLiff } from "@/lib/useLiff";
import { apiFetch } from "@/lib/api";

function LinkForm() {
  const searchParams = useSearchParams();
  const { status, error: liffError, liff } = useLiff();
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const idToken = liff.getIDToken();
      if (!idToken) throw new Error("IDトークンの取得に失敗しました");
      const res = await apiFetch<{ student: { name: string } }>("/liff/link", {
        method: "POST",
        body: JSON.stringify({ idToken, code }),
      });
      setStudentName(res.student.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "連携に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "initializing") {
    return <p className="p-6 text-center text-gray-500">読み込み中...</p>;
  }

  if (status === "error") {
    return <p className="p-6 text-center text-red-600">{liffError}</p>;
  }

  if (studentName) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <h1 className="text-lg font-bold">連携が完了しました</h1>
        <p>{studentName} さんの保護者として登録されました。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">お子さまとの連携</h1>
      <p className="text-sm text-gray-600">教室から受け取った招待コードを入力してください。</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          className="rounded border px-3 py-2 uppercase tracking-widest"
          placeholder="招待コード"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? "連携中..." : "連携する"}
        </button>
      </form>
    </div>
  );
}

export default function LinkPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <Suspense fallback={<p className="text-center text-gray-500">読み込み中...</p>}>
        <LinkForm />
      </Suspense>
    </main>
  );
}
