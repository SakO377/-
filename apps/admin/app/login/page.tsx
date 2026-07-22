"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError, setApiKey } from "@/lib/api";

export default function LoginPage() {
  const [key, setKey] = useState("");
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [mode, setMode] = useState<"password" | "apikey">("password");
  const [creds, setCreds] = useState({ name: "", password: "", code: "" });
  const [showCode, setShowCode] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const router = useRouter();

  async function handlePasswordLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await apiFetch<{ api_key: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          name: creds.name,
          password: creds.password,
          ...(creds.code ? { code: creds.code.trim() } : {}),
        }),
      });
      setApiKey(res.api_key);
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "ログインに失敗しました";
      if (message.includes("コード")) setShowCode(true);
      setLoginError(message);
    }
  }

  useEffect(() => {
    apiFetch<{ enabled: boolean }>("/api/demo/status")
      .then((res) => setDemoEnabled(res.enabled))
      .catch(() => setDemoEnabled(false));
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setApiKey(key.trim());
    router.push("/dashboard");
  }

  async function startDemo() {
    setDemoLoading(true);
    setDemoError(null);
    try {
      const res = await apiFetch<{ api_key: string }>("/api/demo/session", { method: "POST" });
      setApiKey(res.api_key);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDemoError(
          "このデモ環境は既に初期化されています。管理者から共有されたデモ用APIキーでログインしてください。"
        );
      } else {
        setDemoError(err instanceof Error ? err.message : "デモの開始に失敗しました");
      }
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-xl font-bold">School Harness ログイン</h1>

      {demoEnabled && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4">
          <p className="mb-1 font-semibold text-green-800">はじめての方へ</p>
          <p className="mb-3 text-sm text-gray-600">
            登録不要で、見本データ入りの管理画面をそのままお試しいただけます。
          </p>
          <button
            onClick={startDemo}
            disabled={demoLoading}
            className="w-full rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50"
          >
            {demoLoading ? "準備中..." : "デモを試す(ログイン不要)"}
          </button>
          {demoError && <p className="mt-2 text-sm text-red-600">{demoError}</p>}
        </div>
      )}

      <div className="flex gap-2 text-sm">
        <button
          onClick={() => setMode("password")}
          className={`rounded px-3 py-1 ${mode === "password" ? "bg-black text-white" : "bg-gray-100"}`}
        >
          パスワードでログイン
        </button>
        <button
          onClick={() => setMode("apikey")}
          className={`rounded px-3 py-1 ${mode === "apikey" ? "bg-black text-white" : "bg-gray-100"}`}
        >
          APIキーでログイン
        </button>
      </div>

      {mode === "password" ? (
        <form onSubmit={handlePasswordLogin} className="flex flex-col gap-3">
          <input
            className="rounded border px-3 py-2"
            placeholder="お名前(登録済みのスタッフ名)"
            value={creds.name}
            onChange={(e) => setCreds({ ...creds, name: e.target.value })}
            required
          />
          <input
            type="password"
            className="rounded border px-3 py-2"
            placeholder="パスワード"
            value={creds.password}
            onChange={(e) => setCreds({ ...creds, password: e.target.value })}
            required
          />
          {showCode && (
            <input
              className="rounded border px-3 py-2"
              placeholder="認証コード(またはリカバリーコード)"
              value={creds.code}
              onChange={(e) => setCreds({ ...creds, code: e.target.value })}
              autoFocus
            />
          )}
          <button type="submit" className="rounded bg-black px-4 py-2 text-white">
            ログイン
          </button>
          {loginError && <p className="text-sm text-red-600">{loginError}</p>}
          <p className="text-xs text-gray-500">
            パスワードは各スタッフが「設定」画面で登録します。未登録の場合はAPIキーでログインしてください。
          </p>
        </form>
      ) : (
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
      )}
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
