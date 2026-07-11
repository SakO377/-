"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch, getApiKey, API_BASE_URL } from "@/lib/api";
import type { Student } from "@school-harness/shared";

function StudentsList() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ students: Student[] }>("/api/students")
      .then((res) => setStudents(res.students))
      .catch((err) => setError(err instanceof Error ? err.message : "読み込みに失敗しました"));
  }, []);

  async function downloadCsv() {
    const apiKey = getApiKey();
    const res = await fetch(`${API_BASE_URL}/api/students/export.csv`, {
      headers: apiKey ? { "X-API-Key": apiKey } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">生徒一覧</h1>
        <div className="flex gap-2">
          <button
            onClick={downloadCsv}
            className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            CSVダウンロード
          </button>
          <Link href="/students/new" className="rounded bg-black px-3 py-1.5 text-sm text-white">
            + 新規登録
          </Link>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!students && !error && <p className="text-gray-500">読み込み中...</p>}
      {students && students.length === 0 && (
        <p className="text-gray-500">まだ生徒が登録されていません。</p>
      )}
      {students && students.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">氏名</th>
              <th className="py-2">学年</th>
              <th className="py-2">コース</th>
              <th className="py-2">ステータス</th>
              <th className="py-2">タグ</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="py-2">
                  <Link href={`/students/${s.id}`} className="text-blue-600 hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td className="py-2">{s.grade ?? "-"}</td>
                <td className="py-2">{s.course ?? "-"}</td>
                <td className="py-2">{s.status}</td>
                <td className="py-2">{s.tags.join(", ") || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

export default function StudentsPage() {
  return (
    <AuthGuard>
      <NavBar />
      <StudentsList />
    </AuthGuard>
  );
}
