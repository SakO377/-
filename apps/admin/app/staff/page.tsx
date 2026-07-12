"use client";

import { useEffect, useState, type FormEvent } from "react";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch, ApiError } from "@/lib/api";
import type { StaffRole } from "@school-harness/shared";

interface StaffRow {
  id: string;
  name: string;
  role: StaffRole;
  created_at: string;
}

const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "オーナー",
  admin: "管理者",
  staff: "スタッフ",
};

function StaffView() {
  const [rows, setRows] = useState<StaffRow[] | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState({ name: "", role: "staff" as StaffRole });
  const [issued, setIssued] = useState<{ name: string; api_key: string } | null>(null);

  async function load() {
    try {
      const res = await apiFetch<{ staff: StaffRow[]; me: string }>("/api/staff");
      setRows(res.staff);
      setMeId(res.me);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        return;
      }
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await apiFetch<{ name: string; api_key: string }>("/api/staff", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setIssued(res);
      setForm({ name: "", role: "staff" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    }
  }

  async function handleDelete(row: StaffRow) {
    if (!confirm(`${row.name} を削除しますか?本人のAPIキーは使えなくなります。`)) return;
    setError(null);
    try {
      await apiFetch(`/api/staff/${row.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  }

  async function handleReset2fa(row: StaffRow) {
    if (
      !confirm(
        `${row.name} の2段階認証を解除しますか?端末の紛失時など、本人が再設定できるようにします。`
      )
    )
      return;
    setError(null);
    try {
      await apiFetch(`/api/staff/${row.id}/reset-2fa`, { method: "POST" });
      alert(`${row.name} の2段階認証を解除しました。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "解除に失敗しました");
    }
  }

  if (forbidden) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-xl font-bold">スタッフ管理</h1>
        <p className="text-gray-500">
          この画面はオーナー権限のスタッフのみ利用できます。オーナーにお問い合わせください。
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-bold">スタッフ管理</h1>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      {rows && (
        <table className="mb-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">氏名</th>
              <th className="py-2">権限</th>
              <th className="py-2">登録日</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2">
                  {r.name}
                  {r.id === meId && <span className="ml-1 text-xs text-gray-400">(自分)</span>}
                </td>
                <td className="py-2">{ROLE_LABELS[r.role]}</td>
                <td className="py-2">{r.created_at}</td>
                <td className="py-2 text-right">
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => handleReset2fa(r)}
                      className="text-xs text-gray-600 hover:underline"
                    >
                      2FA解除
                    </button>
                    {r.id !== meId && (
                      <button
                        onClick={() => handleDelete(r)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        削除
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="mb-2 font-semibold">スタッフを追加</h2>
      <form onSubmit={handleCreate} className="flex flex-wrap items-center gap-2">
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="氏名"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <select
          className="rounded border px-3 py-2 text-sm"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}
        >
          <option value="staff">スタッフ</option>
          <option value="admin">管理者</option>
          <option value="owner">オーナー</option>
        </select>
        <button type="submit" className="rounded bg-black px-4 py-2 text-sm text-white">
          追加してAPIキーを発行
        </button>
      </form>

      {issued && (
        <div className="mt-4 rounded bg-gray-100 p-4 text-sm">
          <p className="mb-1 font-semibold">{issued.name} さんのAPIキー(この画面限り)</p>
          <code className="break-all">{issued.api_key}</code>
          <p className="mt-2 text-gray-500">
            このキーは二度と表示されません。本人に安全な方法(口頭・紙など)で渡し、ログイン画面から入力してもらってください。
          </p>
        </div>
      )}
    </main>
  );
}

export default function StaffPage() {
  return (
    <AuthGuard>
      <NavBar />
      <StaffView />
    </AuthGuard>
  );
}
