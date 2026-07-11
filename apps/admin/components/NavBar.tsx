"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch, clearApiKey } from "@/lib/api";

interface DashboardCounts {
  absences_pending: number;
  reports_unsent: number;
  invoices_unpaid: { count: number };
}

// バッジを出すリンクは badge キーで対応する件数を参照する
const links: { href: string; label: string; badge?: keyof BadgeMap }[] = [
  { href: "/dashboard", label: "ホーム" },
  { href: "/students", label: "生徒" },
  { href: "/classes", label: "クラス" },
  { href: "/guardians", label: "保護者" },
  { href: "/attendance", label: "入退室" },
  { href: "/absences", label: "欠席・振替", badge: "absences" },
  { href: "/reports", label: "指導報告書", badge: "reports" },
  { href: "/announcements", label: "お知らせ" },
  { href: "/invoices", label: "請求", badge: "invoices" },
  { href: "/staff", label: "スタッフ" },
];

type BadgeMap = { absences: number; reports: number; invoices: number };

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [badges, setBadges] = useState<BadgeMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    function refresh() {
      apiFetch<DashboardCounts>("/api/dashboard")
        .then((d) => {
          if (cancelled) return;
          setBadges({
            absences: d.absences_pending,
            reports: d.reports_unsent,
            invoices: d.invoices_unpaid.count,
          });
        })
        .catch(() => {
          /* バッジ取得の失敗は無視(本体の各ページでエラー表示される) */
        });
    }
    refresh();
    // 別タブでの操作を反映するため、ページ遷移のたびに再取得する
  }, [pathname]);

  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 border-b px-6 py-3">
      <div className="flex flex-wrap gap-4">
        {links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
          const count = l.badge && badges ? badges[l.badge] : 0;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`relative text-sm font-medium ${
                active ? "font-bold text-black underline underline-offset-4" : "text-gray-600 hover:underline"
              }`}
            >
              {l.label}
              {count > 0 && (
                <span className="ml-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <button
        onClick={() => {
          clearApiKey();
          router.push("/login");
        }}
        className="text-sm text-gray-500 hover:underline"
      >
        ログアウト
      </button>
    </nav>
  );
}
