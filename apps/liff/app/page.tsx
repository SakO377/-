import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 p-6">
      <h1 className="mb-2 text-xl font-bold">School Harness</h1>
      <Link href="/absences" className="rounded bg-black px-4 py-2 text-center text-white">
        欠席・振替を連絡する
      </Link>
      <Link href="/reports" className="rounded border px-4 py-2 text-center">
        指導報告書を見る
      </Link>
      <Link href="/announcements" className="rounded border px-4 py-2 text-center">
        お知らせを見る
      </Link>
      <Link href="/link" className="rounded border px-4 py-2 text-center text-sm text-gray-600">
        お子さまと連携する
      </Link>
    </main>
  );
}
