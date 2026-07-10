"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setApiKey } from "@/lib/api";

export default function LoginPage() {
  const [key, setKey] = useState("");
  const router = useRouter();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setApiKey(key.trim());
    router.push("/students");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-xl font-bold">School Harness ログイン</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          className="rounded border px-3 py-2"
          placeholder="APIキー"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          required
        />
        <button type="submit" className="rounded bg-black px-4 py-2 text-white">
          ログイン
        </button>
      </form>
      <p className="text-sm text-gray-500">
        初めての場合は{" "}
        <Link href="/setup" className="text-blue-600 underline">
          初回セットアップ
        </Link>{" "}
        から始めてください。
      </p>
    </main>
  );
}
