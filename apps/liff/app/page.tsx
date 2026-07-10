import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-bold">School Harness</h1>
      <p className="text-gray-600">お子さまとの連携や、欠席・振替のご連絡はこちらから。</p>
      <Link href="/absences" className="rounded bg-black px-4 py-2 text-center text-white">
        欠席・振替を連絡する
      </Link>
      <Link href="/link" className="rounded border px-4 py-2 text-center">
        お子さまと連携する
      </Link>
    </main>
  );
}
