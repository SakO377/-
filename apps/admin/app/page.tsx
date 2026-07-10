import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">School Harness 管理画面</h1>
      <p className="text-gray-600">塾・習い事教室向けオープンソース運営管理システムです。</p>
      <div className="flex gap-3">
        <Link href="/setup" className="rounded bg-black px-4 py-2 text-white">
          初回セットアップ
        </Link>
        <Link href="/login" className="rounded border px-4 py-2">
          ログイン
        </Link>
      </div>
    </main>
  );
}
