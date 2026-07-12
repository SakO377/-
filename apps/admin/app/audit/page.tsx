"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch, ApiError } from "@/lib/api";

interface AuditLog {
  id: string;
  staff_name: string | null;
  method: string;
  path: string;
  status: number | null;
  created_at: string;
}

// パス+メソッドを日本語の操作名に変換する(主要な更新系のみ)
function describe(method: string, path: string): string {
  const rules: { test: RegExp; label: string }[] = [
    { test: /^\/api\/students\/[^/]+\/qr-token$/, label: "QRコード再発行" },
    { test: /^\/api\/students\/[^/]+\/invite-codes$/, label: "招待コード発行" },
    { test: /^\/api\/students\/import\.csv$/, label: "生徒CSV取り込み" },
    { test: /^\/api\/students\/promote-grades$/, label: "一括進級" },
    { test: /^\/api\/students\/[^/]+$/, label: method === "DELETE" ? "生徒を削除" : "生徒情報を更新" },
    { test: /^\/api\/students$/, label: "生徒を登録" },
    { test: /^\/api\/invoices\/bulk$/, label: "請求書を一括作成" },
    { test: /^\/api\/invoices\/remind-unpaid$/, label: "未入金を一括督促" },
    { test: /^\/api\/invoices\/[^/]+\/remind$/, label: "支払い督促" },
    { test: /^\/api\/invoices\/[^/]+\/send$/, label: "請求書を送信" },
    { test: /^\/api\/invoices\/[^/]+$/, label: "請求書を更新" },
    { test: /^\/api\/invoices$/, label: "請求書を作成" },
    { test: /^\/api\/announcements\/[^/]+$/, label: method === "DELETE" ? "お知らせを取消" : "お知らせ更新" },
    { test: /^\/api\/announcements$/, label: "お知らせを作成" },
    { test: /^\/api\/reports\/[^/]+\/send$/, label: "報告書を送信" },
    { test: /^\/api\/reports$/, label: "報告書を作成" },
    { test: /^\/api\/absences\/[^/]+$/, label: "欠席・振替を更新" },
    { test: /^\/api\/grades/, label: "成績を記録/削除" },
    { test: /^\/api\/trials/, label: "体験予約を操作" },
    { test: /^\/api\/referrals/, label: "紹介を操作" },
    { test: /^\/api\/shifts/, label: "シフトを操作" },
    { test: /^\/api\/staff/, label: "スタッフを操作" },
    { test: /^\/api\/settings/, label: "設定を変更" },
    { test: /^\/api\/auth\/set-password$/, label: "パスワードを設定" },
  ];
  const hit = rules.find((r) => r.test.test(path));
  return hit ? hit.label : `${method} ${path}`;
}

function AuditView() {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    apiFetch<{ logs: AuditLog[] }>("/api/audit")
      .then((res) => setLogs(res.logs))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) setForbidden(true);
        else setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      });
  }, []);

  if (forbidden)
    return (
      <main className="mx-auto max-w-3xl p-6 text-gray-600">
        操作ログはオーナー権限のスタッフのみ閲覧できます。
      </main>
    );

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-xl font-bold">操作ログ</h1>
      <p className="mb-4 text-sm text-gray-500">
        誰がいつどの操作(更新・削除など)を行ったかの記録です(直近100件)。
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {logs === null && !error && <p className="text-gray-500">読み込み中...</p>}
      {logs && logs.length === 0 && <p className="text-gray-500">まだ記録はありません。</p>}
      {logs && logs.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">日時</th>
              <th className="py-2">担当者</th>
              <th className="py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="py-1.5 whitespace-nowrap text-gray-500">{l.created_at}</td>
                <td className="py-1.5">{l.staff_name ?? "-"}</td>
                <td className="py-1.5">{describe(l.method, l.path)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

export default function AuditPage() {
  return (
    <AuthGuard>
      <NavBar />
      <AuditView />
    </AuthGuard>
  );
}
