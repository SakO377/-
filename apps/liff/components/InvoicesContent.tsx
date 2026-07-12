"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiff } from "@/lib/useLiff";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import PageHeader from "@/components/PageHeader";

interface InvoiceRow {
  id: string;
  student_name: string;
  year_month: string;
  total: number;
  paid_status: string;
}

export default function InvoicesContent({ onBack }: { onBack: () => void }) {
  const { status, error: liffError, liff } = useLiff();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const authHeader = useCallback((): Record<string, string> => {
    const idToken = liff.getIDToken();
    return idToken ? { Authorization: `Bearer ${idToken}` } : {};
  }, [liff]);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ invoices: InvoiceRow[] }>("/liff/invoices", {
        headers: authHeader(),
      });
      setInvoices(res.invoices);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    }
  }, [authHeader]);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  async function openPrintView(id: string) {
    const res = await fetch(`${API_BASE_URL}/liff/invoices/${id}/print`, { headers: authHeader() });
    const html = await res.text();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  if (status === "initializing") return <p className="text-center text-gray-500">読み込み中...</p>;
  if (status === "error") return <p className="text-center text-red-600">{liffError}</p>;

  return (
    <div>
      <PageHeader title="請求書" onBack={onBack} />
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {invoices.length === 0 && <p className="text-sm text-gray-500">請求書はまだありません。</p>}
      <ul className="flex flex-col gap-3">
        {invoices.map((inv) => (
          <li key={inv.id} className="rounded border p-3 text-sm">
            <p className="font-semibold">
              {inv.student_name} / {inv.year_month}
            </p>
            <p>
              ¥{inv.total.toLocaleString("ja-JP")}({inv.paid_status})
            </p>
            <button
              onClick={() => openPrintView(inv.id)}
              className="mt-2 rounded bg-black px-3 py-1 text-xs text-white"
            >
              請求書を表示
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
