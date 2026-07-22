"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch, getApiKey, API_BASE_URL } from "@/lib/api";
import type { Student, StudentStatus } from "@school-harness/shared";

type StatusFilter = "all" | StudentStatus;
const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "在籍", label: "在籍" },
  { key: "休会", label: "休会" },
  { key: "退会", label: "退会" },
];

function StudentsList() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!students) return [];
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [s.name, s.name_kana ?? "", s.grade ?? "", s.course ?? "", ...s.tags]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [students, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: students?.length ?? 0, 在籍: 0, 休会: 0, 退会: 0 };
    for (const s of students ?? []) c[s.status] = (c[s.status] ?? 0) + 1;
    return c;
  }, [students]);

  function reload() {
    apiFetch<{ students: Student[] }>("/api/students")
      .then((res) => setStudents(res.students))
      .catch((err) => setError(err instanceof Error ? err.message : "読み込みに失敗しました"));
  }

  useEffect(() => {
    reload();
  }, []);

  async function importCsv(file: File) {
    const text = await file.text();
    try {
      const apiKey = getApiKey();
      const res = await fetch(`${API_BASE_URL}/api/students/import.csv`, {
        method: "POST",
        headers: {
          "Content-Type": "text/csv",
          ...(apiKey ? { "X-API-Key": apiKey } : {}),
        },
        body: text,
      });
      const body = (await res.json()) as {
        created?: number;
        errors?: { row: number; reason: string }[];
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "取り込みに失敗しました");
      const errCount = body.errors?.length ?? 0;
      alert(
        `${body.created ?? 0} 名を取り込みました。` +
          (errCount > 0
            ? `\n取り込めなかった行: ${errCount} 件\n` +
              body
                .errors!.slice(0, 10)
                .map((e) => `${e.row}行目: ${e.reason}`)
                .join("\n")
            : "")
      );
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "取り込みに失敗しました");
    }
  }

  async function promoteGrades() {
    if (
      !window.confirm(
        "在籍・休会の全生徒の学年を1つ上げます(高3など最上位は据え置き)。よろしいですか?\n※毎年4月1日には自動で実行されます。"
      )
    )
      return;
    const res = await apiFetch<{ promoted: number }>("/api/students/promote-grades", {
      method: "POST",
    });
    alert(`${res.promoted} 名を進級しました。`);
    apiFetch<{ students: Student[] }>("/api/students").then((r) => setStudents(r.students));
  }

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
            onClick={promoteGrades}
            className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            一括進級
          </button>
          <button
            onClick={downloadCsv}
            className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            CSVダウンロード
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importCsv(file);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            CSVインポート
          </button>
          <Link href="/students/new" className="rounded bg-black px-3 py-1.5 text-sm text-white">
            + 新規登録
          </Link>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {students && students.length > 0 && (
        <>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setStatusFilter(t.key)}
                  className={`rounded-full px-3 py-1 text-sm ${
                    statusFilter === t.key ? "bg-black text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {t.label}
                  <span className="ml-1 text-xs opacity-70">{counts[t.key] ?? 0}</span>
                </button>
              ))}
            </div>
            <input
              className="rounded border px-3 py-1.5 text-sm sm:w-64"
              placeholder="氏名・ふりがな・学年・タグで検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-gray-500">該当する生徒がいません。</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2">氏名</th>
                  <th className="py-2">学年</th>
                  <th className="py-2">コース</th>
                  <th className="py-2">ステータス</th>
                  <th className="py-2">入会日</th>
                  <th className="py-2">タグ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="py-2">
                      <Link
                        href={`/students/detail?id=${s.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td className="py-2">{s.grade ?? "-"}</td>
                    <td className="py-2">{s.course ?? "-"}</td>
                    <td className="py-2">{s.status}</td>
                    <td className="py-2 text-gray-500">
                      {s.enrolled_at ?? "-"}
                      {s.status === "退会" && s.withdrawn_at && (
                        <span className="block text-xs text-gray-400">退会 {s.withdrawn_at}</span>
                      )}
                    </td>
                    <td className="py-2">{s.tags.join(", ") || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {!students && !error && <p className="text-gray-500">読み込み中...</p>}
      {students && students.length === 0 && (
        <p className="text-gray-500">まだ生徒が登録されていません。</p>
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
