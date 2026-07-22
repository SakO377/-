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

interface RevenueMonth {
  year_month: string;
  invoiced: number;
  paid: number;
  difference: number;
}

interface RevenueData {
  projected_monthly: number;
  months: RevenueMonth[];
}

interface AtRiskStudent {
  id: string;
  name: string;
  grade: string | null;
  reasons: string[];
  overdue_unpaid: number;
}

interface AtRiskData {
  at_risk: AtRiskStudent[];
  criteria: { unpaid_days: number };
}

function yen(value: number) {
  return `¥${value.toLocaleString("ja-JP")}`;
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

function RevenueSection({ revenue }: { revenue: RevenueData }) {
  const max = Math.max(1, ...revenue.months.map((m) => Math.max(m.invoiced, m.paid)));
  const latest = revenue.months[revenue.months.length - 1];
  return (
    <section className="mt-6 rounded-lg border p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">売上の推移</h2>
        <p className="text-sm text-gray-500">
          今後の月見込み(在籍生徒の月謝合計):
          <span className="ml-1 font-semibold text-gray-800">{yen(revenue.projected_monthly)}</span>
        </p>
      </div>

      {/* 月ごとの請求額(予定)と入金額(実績)の棒グラフ */}
      <div className="flex items-end gap-3 overflow-x-auto pb-2">
        {revenue.months.map((m) => (
          <div key={m.year_month} className="flex min-w-[52px] flex-1 flex-col items-center gap-1">
            <div className="flex h-32 items-end gap-1" title={`請求 ${yen(m.invoiced)} / 入金 ${yen(m.paid)}`}>
              <div
                className="w-4 rounded-t bg-gray-300"
                style={{ height: `${(m.invoiced / max) * 100}%` }}
              />
              <div
                className="w-4 rounded-t bg-green-500"
                style={{ height: `${(m.paid / max) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-500">{m.year_month.slice(5)}月</span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-gray-300" />請求額(予定)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-green-500" />入金額(実績)
        </span>
      </div>

      {latest && (
        <div className="mt-3 rounded bg-gray-50 p-3 text-sm">
          <p className="text-gray-600">
            今月({latest.year_month}):請求 {yen(latest.invoiced)} / 入金 {yen(latest.paid)}
          </p>
          <p className={`mt-0.5 font-semibold ${latest.difference > 0 ? "text-red-600" : "text-gray-800"}`}>
            未回収(予定との差分):{yen(latest.difference)}
          </p>
        </div>
      )}
    </section>
  );
}

function AtRiskSection({ atRisk }: { atRisk: AtRiskData }) {
  return (
    <section className="mt-6 rounded-lg border p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="font-semibold">気にかけたい生徒(未入金)</h2>
        <span className="text-xs text-gray-400">未入金{atRisk.criteria.unpaid_days}日以上</span>
      </div>
      {atRisk.at_risk.length === 0 ? (
        <p className="text-sm text-gray-500">いまのところ気になる生徒はいません。</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {atRisk.at_risk.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-2 rounded border border-amber-200 bg-amber-50 p-2 text-sm"
            >
              <Link
                href={`/students/detail?id=${s.id}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {s.name}
              </Link>
              <span className="text-xs text-gray-500">{s.grade ?? ""}</span>
              <span className="flex flex-wrap gap-1">
                {s.reasons.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-900"
                  >
                    {r}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [atRisk, setAtRisk] = useState<AtRiskData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DashboardData>("/api/dashboard")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "読み込みに失敗しました"));
    apiFetch<RevenueData>("/api/dashboard/revenue?months=6").then(setRevenue).catch(() => {});
    apiFetch<AtRiskData>("/api/dashboard/at-risk").then(setAtRisk).catch(() => {});
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

      {revenue && <RevenueSection revenue={revenue} />}
      {atRisk && <AtRiskSection atRisk={atRisk} />}
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
