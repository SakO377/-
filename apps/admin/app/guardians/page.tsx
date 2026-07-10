"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch } from "@/lib/api";
import type { Guardian } from "@school-harness/shared";

function GuardiansList() {
  const [guardians, setGuardians] = useState<Guardian[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ guardians: Guardian[] }>("/api/guardians")
      .then((res) => setGuardians(res.guardians))
      .catch((err) => setError(err instanceof Error ? err.message : "読み込みに失敗しました"));
  }, []);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-bold">保護者一覧</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {guardians && guardians.length === 0 && (
        <p className="text-gray-500">
          まだ保護者が登録されていません。生徒詳細ページから招待コードを発行してLINE連携してもらってください。
        </p>
      )}
      {guardians && guardians.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">氏名</th>
              <th className="py-2">LINE連携</th>
              <th className="py-2">通知</th>
            </tr>
          </thead>
          <tbody>
            {guardians.map((g) => (
              <tr key={g.id} className="border-b">
                <td className="py-2">{g.name ?? "(未設定)"}</td>
                <td className="py-2">{g.line_user_id ? "連携済み" : "未連携"}</td>
                <td className="py-2">{g.push_notifications_enabled ? "ON" : "OFF"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

export default function GuardiansPage() {
  return (
    <AuthGuard>
      <NavBar />
      <GuardiansList />
    </AuthGuard>
  );
}
