"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch } from "@/lib/api";

interface DashboardData {
  students: { active: number };
  attendance_today: { check_in: number; check_out: number };
  absences_pending: number;
  reports_unsent: number;
  announcements_scheduled: number;
  invoices_unpaid: { count: number; total: number };
  line_quota: { used: number; quota: number; remaining: number };
}

function Card({
  href,
  label,
  value,
  sub,
  alert,
}: {
  href: string;
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg border p-4 transition hover:bg-gray-50 ${
        alert ? "border-red-300 bg-red-50 hover:bg-red-100" : ""
      }`}
    >
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${alert ? "text-red-600" : ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </Link>
  );
}

function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DashboardData>("/api/dashboard")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "読み込みに失敗しました"));
  }, []);

  if (error) return <main className="p-6 text-red-600">{error}</main>;
  if (!data) return <main className="p-6 text-gray-500">読み込み中...</main>;

  const quotaRatio = data.line_quota.quota > 0 ? data.line_quota.used / data.line_quota.quota : 0;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-xl font-bold">ダッシュボード</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card
          href="/attendance"
          label="今日の入退室"
          value={`${data.attendance_today.check_in} 入 / ${data.attendance_today.check_out} 退`}
        />
        <Card
          href="/absences"
          label="未対応の欠席・振替"
          value={`${data.absences_pending} 件`}
          alert={data.absences_pending > 0}
        />
        <Card
          href="/reports"
          label="未送信の報告書"
          value={`${data.reports_unsent} 件`}
          alert={data.reports_unsent > 0}
        />
        <Card
          href="/invoices"
          label="未入金の請求"
          value={`${data.invoices_unpaid.count} 件`}
          sub={`合計 ¥${data.invoices_unpaid.total.toLocaleString("ja-JP")}`}
          alert={data.invoices_unpaid.count > 0}
        />
        <Card
          href="/announcements"
          label="予約中のお知らせ"
          value={`${data.announcements_scheduled} 件`}
        />
        <Card href="/students" label="在籍生徒" value={`${data.students.active} 名`} />
      </div>

      <div className="mt-4 rounded-lg border p-4">
        <div className="mb-1 flex items-baseline justify-between">
          <p className="text-sm text-gray-500">LINE無料メッセージ枠(今月)</p>
          <p className="text-sm font-semibold">
            {data.line_quota.used} / {data.line_quota.quota} 通(残り {data.line_quota.remaining}{" "}
            通)
          </p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded bg-gray-100">
          <div
            className={`h-full ${quotaRatio > 0.8 ? "bg-red-500" : "bg-black"}`}
            style={{ width: `${Math.min(quotaRatio * 100, 100)}%` }}
          />
        </div>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <NavBar />
      <DashboardView />
    </AuthGuard>
  );
}
