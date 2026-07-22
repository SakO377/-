"use client";

import { useState, type FormEvent } from "react";
import { useLiff } from "@/lib/useLiff";
import { apiFetch } from "@/lib/api";
import PageHeader from "@/components/PageHeader";

export default function LinkContent({
  initialCode,
  onBack,
}: {
  initialCode: string;
  onBack: () => void;
}) {
  const { status, error: liffError, liff } = useLiff();
  const [code, setCode] = useState(initialCode);
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
    return <p className="text-center text-gray-500">読み込み中...</p>;
  }

  if (status === "error") {
    return <p className="text-center text-red-600">{liffError}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="お子さまとの連携" onBack={onBack} />
      {studentName ? (
        <div className="flex flex-col gap-3 text-center">
          <h2 className="text-lg font-bold">連携が完了しました</h2>
          <p>{studentName} さんの保護者として登録されました。</p>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
