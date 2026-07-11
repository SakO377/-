"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearApiKey } from "@/lib/api";

const links = [
  { href: "/dashboard", label: "ホーム" },
  { href: "/students", label: "生徒" },
  { href: "/classes", label: "クラス" },
  { href: "/guardians", label: "保護者" },
  { href: "/attendance", label: "入退室" },
  { href: "/absences", label: "欠席・振替" },
  { href: "/reports", label: "指導報告書" },
  { href: "/announcements", label: "お知らせ" },
  { href: "/invoices", label: "請求" },
  { href: "/staff", label: "スタッフ" },
];

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 border-b px-6 py-3">
      <div className="flex flex-wrap gap-4">
        {links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm font-medium ${
                active ? "font-bold text-black underline underline-offset-4" : "text-gray-600 hover:underline"
              }`}
            >
              {l.label}
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
