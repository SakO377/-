"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import AbsencesContent from "@/components/AbsencesContent";
import ReportsContent from "@/components/ReportsContent";
import AnnouncementsContent from "@/components/AnnouncementsContent";
import InvoicesContent from "@/components/InvoicesContent";
import LinkContent from "@/components/LinkContent";

type View = "home" | "absences" | "reports" | "announcements" | "invoices" | "link";

// LIFFはliff.line.me経由でのサブパス遷移が正しく機能しないことがあるため、
// URLを変えずに単一ページ内でボタン切り替え(クライアント側の状態管理)する構成にしている。
function AppShell() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>("home");
  const initialCode = searchParams.get("code") ?? "";

  const goHome = () => setView("home");

  if (view === "absences") return <AbsencesContent onBack={goHome} />;
  if (view === "reports") return <ReportsContent onBack={goHome} />;
  if (view === "announcements") return <AnnouncementsContent onBack={goHome} />;
  if (view === "invoices") return <InvoicesContent onBack={goHome} />;
  if (view === "link") return <LinkContent initialCode={initialCode} onBack={goHome} />;

  return (
    <div className="flex flex-col gap-3">
      <h1 className="mb-2 text-xl font-bold">School Harness</h1>
      <button
        onClick={() => setView("absences")}
        className="rounded bg-black px-4 py-2 text-center text-white"
      >
        欠席・振替を連絡する
      </button>
      <button onClick={() => setView("reports")} className="rounded border px-4 py-2 text-center">
        指導報告書を見る
      </button>
      <button
        onClick={() => setView("announcements")}
        className="rounded border px-4 py-2 text-center"
      >
        お知らせを見る
      </button>
      <button onClick={() => setView("invoices")} className="rounded border px-4 py-2 text-center">
        請求書を見る
      </button>
      <button
        onClick={() => setView("link")}
        className="rounded border px-4 py-2 text-center text-sm text-gray-600"
      >
        お子さまと連携する
      </button>
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <Suspense fallback={<p className="text-center text-gray-500">読み込み中...</p>}>
        <AppShell />
      </Suspense>
    </main>
  );
}
