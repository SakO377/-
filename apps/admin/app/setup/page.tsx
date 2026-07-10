"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { apiFetch, setApiKey } from "@/lib/api";

export default function SetupPage() {
  const [name, setName] = useState("");
  const [result, setResult] = useState<{ api_key: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ api_key: string }>("/api/setup/init", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setApiKey(res.api_key);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "セットアップに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
        <h1 className="text-xl font-bold">セットアップ完了</h1>
        <p className="text-sm text-gray-600">
          APIキーをこの端末に保存しました。以下のキーは二度と表示されないので、必ず控えてください。
        </p>
        <code className="break-all rounded bg-gray-100 p-3 text-sm">{result.api_key}</code>
        <Link href="/students" className="text-blue-600 underline">
          管理画面へ進む
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-xl font-bold">初回セットアップ</h1>
      <p className="text-sm text-gray-600">
        オーナー(owner)アカウントを1件作成します。この操作はスタッフが1件も存在しない場合のみ実行できます。
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          className="rounded border px-3 py-2"
          placeholder="お名前"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "作成中..." : "作成する"}
        </button>
      </form>
      <p className="text-sm text-gray-500">
        既にAPIキーをお持ちの場合は{" "}
        <Link href="/login" className="text-blue-600 underline">
          こちら
        </Link>{" "}
        からログインしてください。
      </p>
    </main>
  );
}
