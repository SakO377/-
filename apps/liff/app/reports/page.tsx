"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiff } from "@/lib/useLiff";
import { apiFetch } from "@/lib/api";

interface ReportRow {
  id: string;
  student_name: string;
  author: string | null;
  body: string;
  read_at: string | null;
}

function ReportsContent() {
  const { status, error: liffError, liff } = useLiff();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const authHeader = useCallback((): Record<string, string> => {
    const idToken = liff.getIDToken();
    return idToken ? { Authorization: `Bearer ${idToken}` } : {};
  }, [liff]);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ reports: ReportRow[] }>("/liff/reports", {
        headers: authHeader(),
      });
      setReports(res.reports);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    }
  }, [authHeader]);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  async function markRead(id: string) {
    await apiFetch(`/liff/reports/${id}/read`, { method: "POST", headers: authHeader() });
    load();
  }

  if (status === "initializing") return <p className="text-center text-gray-500">読み込み中...</p>;
  if (status === "error") return <p className="text-center text-red-600">{liffError}</p>;

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold">指導報告書</h1>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {reports.length === 0 && <p className="text-sm text-gray-500">まだ報告書はありません。</p>}
      <ul className="flex flex-col gap-3">
        {reports.map((r) => (
          <li
            key={r.id}
            onClick={() => !r.read_at && markRead(r.id)}
            className="rounded border p-3 text-sm"
          >
            <p className="font-semibold">
              {r.student_name}
              {r.author ? ` / ${r.author}` : ""}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{r.body}</p>
            <p className="mt-1 text-xs text-gray-500">{r.read_at ? "既読" : "未読(タップで既読)"}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-md p-6">
      <ReportsContent />
    </main>
  );
}
