"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch } from "@/lib/api";
import type { AbsenceStatus } from "@school-harness/shared";

interface AbsenceRow {
  id: string;
  student_name: string;
  date: string;
  reason: string | null;
  status: AbsenceStatus;
  makeup_date: string | null;
}

function AbsencesView() {
  const [absences, setAbsences] = useState<AbsenceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [makeupDrafts, setMakeupDrafts] = useState<Record<string, string>>({});

  async function load() {
    try {
      const res = await apiFetch<{ absences: AbsenceRow[] }>("/api/absences");
      setAbsences(res.absences);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function proposeMakeup(id: string) {
    const makeup_date = makeupDrafts[id];
    if (!makeup_date) return;
    await apiFetch(`/api/absences/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "振替提案", makeup_date }),
    });
    load();
  }

  async function confirm(id: string) {
    await apiFetch(`/api/absences/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "確定" }),
    });
    load();
  }

  async function reopen(id: string) {
    await apiFetch(`/api/absences/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "申請" }),
    });
    load();
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-2 text-xl font-bold">欠席・振替連絡</h1>
      <div className="mb-4 rounded-lg border bg-gray-50 p-3 text-sm text-gray-600">
        <p className="mb-1 font-semibold">振替のすすめ方(3ステップ)</p>
        <ol className="list-inside list-decimal space-y-0.5">
          <li>
            <span className="font-medium text-gray-800">申請</span>
            :保護者から欠席の連絡が届いた状態。
          </li>
          <li>
            <span className="font-medium text-gray-800">振替提案</span>
            :別日の候補を入力して「振替日を提案」を押すと、この状態になります。
          </li>
          <li>
            <span className="font-medium text-gray-800">確定</span>
            :保護者と振替日が合意できたら「確定にする」を押して完了です。
          </li>
        </ol>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {absences && absences.length === 0 && <p className="text-gray-500">連絡はまだありません。</p>}
      {absences && absences.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">生徒</th>
              <th className="py-2">欠席日</th>
              <th className="py-2">理由</th>
              <th className="py-2">ステータス</th>
              <th className="py-2">振替日</th>
              <th className="py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {absences.map((a) => (
              <tr key={a.id} className="border-b align-top">
                <td className="py-2">{a.student_name}</td>
                <td className="py-2">{a.date}</td>
                <td className="py-2">{a.reason ?? "-"}</td>
                <td className="py-2">
                  <StatusBadge status={a.status} />
                </td>
                <td className="py-2">{a.makeup_date ?? "-"}</td>
                <td className="py-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-gray-500">
                      {a.status === "確定" ? "振替日" : "① 振替日の候補を入力"}
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="date"
                        className="rounded border px-2 py-1 text-xs"
                        value={makeupDrafts[a.id] ?? a.makeup_date ?? ""}
                        onChange={(e) =>
                          setMakeupDrafts({ ...makeupDrafts, [a.id]: e.target.value })
                        }
                      />
                      <button
                        onClick={() => proposeMakeup(a.id)}
                        className="whitespace-nowrap rounded border px-2 py-1 text-xs hover:bg-gray-50"
                      >
                        {a.status === "申請" ? "② 振替日を提案" : "候補を更新"}
                      </button>
                    </div>
                    {a.status !== "確定" ? (
                      <button
                        onClick={() => confirm(a.id)}
                        className="rounded bg-black px-2 py-1 text-xs text-white"
                      >
                        ③ 確定にする
                      </button>
                    ) : (
                      <button
                        onClick={() => reopen(a.id)}
                        className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        確定を取り消す
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: AbsenceStatus }) {
  const styles: Record<AbsenceStatus, string> = {
    申請: "bg-yellow-100 text-yellow-800",
    振替提案: "bg-blue-100 text-blue-800",
    確定: "bg-green-100 text-green-800",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${styles[status]}`}>
      {status}
    </span>
  );
}

export default function AbsencesPage() {
  return (
    <AuthGuard>
      <NavBar />
      <AbsencesView />
    </AuthGuard>
  );
}
