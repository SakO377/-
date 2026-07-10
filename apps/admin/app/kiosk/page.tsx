"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";

interface CheckinResult {
  student_name: string;
  type: "check_in" | "check_out";
  notified: boolean;
}

// 教室のタブレット/PCに常時表示しておく画面。
// USB接続のQR/バーコードリーダー(キーボード入力として認識されるもの)で
// 生徒のQRカードを読み取ると、この隠しinputに自動入力されEnterで確定する。
export default function KioskPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [token, setToken] = useState("");
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!result && !error) return;
    const timer = setTimeout(() => {
      setResult(null);
      setError(null);
      inputRef.current?.focus();
    }, 3000);
    return () => clearTimeout(timer);
  }, [result, error]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const qrToken = token.trim();
    setToken("");
    if (!qrToken) return;
    try {
      const res = await apiFetch<CheckinResult>("/kiosk/checkin", {
        method: "POST",
        body: JSON.stringify({ qr_token: qrToken }),
      });
      setResult(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み取りに失敗しました");
      setResult(null);
    }
    inputRef.current?.focus();
  }

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 p-8 text-center"
      onClick={() => inputRef.current?.focus()}
    >
      <h1 className="text-2xl font-bold">School Harness 入退室チェック</h1>
      <p className="text-gray-500">QRカードをスキャナーにかざしてください</p>

      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="h-1 w-1 opacity-0"
          autoFocus
        />
      </form>

      {result && (
        <div className="rounded-lg bg-white p-8 text-3xl font-bold shadow">
          {result.student_name} さん
          <div className="mt-2 text-2xl">
            {result.type === "check_in" ? "入室しました" : "退室しました"}
          </div>
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 p-8 text-xl text-red-600 shadow">{error}</div>
      )}
    </main>
  );
}
