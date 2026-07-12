"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiff } from "@/lib/useLiff";
import { apiFetch, ApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import NotLinkedNotice from "@/components/NotLinkedNotice";

interface ReportRow {
  id: string;
  student_name: string;
  author: string | null;
  body: string;
  read_at: string | null;
  sent_at: string | null;
  created_at: string;
}

// "YYYY-MM-DD HH:MM:SS"(UTC) を日本時間の「M月D日」に整形する
function formatDate(value: string | null): string {
  if (!value) return "";
  const d = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return "";
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日`;
}

export default function ReportsContent({
  onBack,
  onGoToLink,
}: {
  onBack: () => void;
  onGoToLink: () => void;
}) {
  const { status, error: liffError, liff } = useLiff();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notLinked, setNotLinked] = useState(false);

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

  async function markRead(id: string) {
    await apiFetch(`/liff/reports/${id}/read`, { method: "POST", headers: authHeader() });
    load();
  }

  if (status === "initializing") return <p className="text-center text-gray-500">読み込み中...</p>;
  if (status === "error") return <p className="text-center text-red-600">{liffError}</p>;
  if (notLinked) {
    return (
      <div>
        <PageHeader title="指導報告書" onBack={onBack} />
        <NotLinkedNotice onGoToLink={onGoToLink} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="指導報告書" onBack={onBack} />
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {reports.length === 0 && <p className="text-sm text-gray-500">まだ報告書はありません。</p>}
      <ul className="flex flex-col gap-3">
        {reports.map((r) => (
          <li
            key={r.id}
            onClick={() => !r.read_at && markRead(r.id)}
            className="rounded border p-3 text-sm"
          >
            <p className="text-xs text-gray-500">{formatDate(r.sent_at ?? r.created_at)}</p>
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
