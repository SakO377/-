"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch, getApiKey, API_BASE_URL } from "@/lib/api";

interface AttendanceRow {
  id: string;
  student_name: string;
  type: "check_in" | "check_out";
  timestamp: string;
  notified_at: string | null;
}

interface SettingsStatus {
  attendance_push_enabled: boolean;
  line_quota: { used: number; quota: number; remaining: number };
}

function AttendanceView() {
  const [rows, setRows] = useState<AttendanceRow[] | null>(null);
  const [settingsStatus, setSettingsStatus] = useState<SettingsStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [attendanceRes, settingsRes] = await Promise.all([
        apiFetch<{ attendance: AttendanceRow[] }>("/api/attendance"),
        apiFetch<SettingsStatus>("/api/settings"),
      ]);
      setRows(attendanceRes.attendance);
      setSettingsStatus(settingsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function togglePush() {
    if (!settingsStatus) return;
    const res = await apiFetch<SettingsStatus>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ attendance_push_enabled: !settingsStatus.attendance_push_enabled }),
    });
    setSettingsStatus(res);
  }

  async function downloadCsv() {
    const apiKey = getApiKey();
    const res = await fetch(`${API_BASE_URL}/api/attendance/export.csv`, {
      headers: apiKey ? { "X-API-Key": apiKey } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendance.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">入退室履歴</h1>
        <div className="flex gap-2">
          <a
            href="/kiosk"
            target="_blank"
            rel="noreferrer"
            className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            チェックイン画面を開く
          </a>
          <button
            onClick={downloadCsv}
            className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            CSVダウンロード
          </button>
        </div>
      </div>

      {settingsStatus && (
        <div className="mb-6 rounded border p-4 text-sm">
          <p className="mb-2">
            LINE無料メッセージ枠(今月): {settingsStatus.line_quota.used} /{" "}
            {settingsStatus.line_quota.quota} 通使用(残り {settingsStatus.line_quota.remaining} 通)
          </p>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settingsStatus.attendance_push_enabled}
              onChange={togglePush}
            />
            入退室のLINE通知(Push)を有効にする
          </label>
          <p className="mt-1 text-gray-500">
            OFFの場合、保護者はLIFF内の入退室履歴で確認できます(無料枠を消費しません)。
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {rows && rows.length === 0 && <p className="text-gray-500">まだ入退室記録がありません。</p>}
      {rows && rows.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">日時</th>
              <th className="py-2">生徒</th>
              <th className="py-2">種別</th>
              <th className="py-2">通知</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2">{r.timestamp}</td>
                <td className="py-2">{r.student_name}</td>
                <td className="py-2">{r.type === "check_in" ? "入室" : "退室"}</td>
                <td className="py-2">{r.notified_at ? "通知済み" : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

export default function AttendancePage() {
  return (
    <AuthGuard>
      <NavBar />
      <AttendanceView />
    </AuthGuard>
  );
}
