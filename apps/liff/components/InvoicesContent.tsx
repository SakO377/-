"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiff } from "@/lib/useLiff";
import { apiFetch, ApiError, API_BASE_URL } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import NotLinkedNotice from "@/components/NotLinkedNotice";

interface InvoiceRow {
  id: string;
  student_name: string;
  year_month: string;
  total: number;
  paid_status: string;
  payment_reported_at: string | null;
}

interface BankTransfer {
  bank_name: string;
  bank_branch: string;
  bank_account_type: string;
  bank_account_number: string;
  bank_account_holder: string;
  payment_note: string;
}

export default function InvoicesContent({
  onBack,
  onGoToLink,
}: {
  onBack: () => void;
  onGoToLink: () => void;
}) {
  const { status, error: liffError, liff } = useLiff();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [bank, setBank] = useState<BankTransfer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notLinked, setNotLinked] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);

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
      const info = await apiFetch<{ bank_transfer: BankTransfer; configured: boolean }>(
        "/liff/payment-info",
        { headers: authHeader() }
      );
      setBank(info.configured ? info.bank_transfer : null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 401)) {
        setNotLinked(true);
        return;
      }
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

  async function reportPayment(id: string) {
    if (!window.confirm("この請求について「振り込みました」と教室に報告しますか?")) return;
    setReporting(id);
    try {
      await apiFetch(`/liff/invoices/${id}/report-payment`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ note: null }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "報告に失敗しました");
    } finally {
      setReporting(null);
    }
  }

  function statusLabel(inv: InvoiceRow): { text: string; className: string } {
    if (inv.paid_status === "入金済") return { text: "入金済", className: "text-green-700" };
    if (inv.payment_reported_at) return { text: "確認待ち", className: "text-amber-700" };
    return { text: "未入金", className: "text-red-600" };
  }

  if (status === "initializing") return <p className="text-center text-gray-500">読み込み中...</p>;
  if (status === "error") return <p className="text-center text-red-600">{liffError}</p>;
  if (notLinked) {
    return (
      <div>
        <PageHeader title="請求書" onBack={onBack} />
        <NotLinkedNotice onGoToLink={onGoToLink} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="請求書" onBack={onBack} />
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      {bank && (
        <div className="mb-4 rounded border bg-gray-50 p-3 text-sm">
          <p className="mb-1 font-semibold">お振込先</p>
          <p>
            {bank.bank_name} {bank.bank_branch} {bank.bank_account_type} {bank.bank_account_number}
          </p>
          {bank.bank_account_holder && <p>名義: {bank.bank_account_holder}</p>}
          {bank.payment_note && <p className="mt-1 text-gray-500">{bank.payment_note}</p>}
          <p className="mt-1 text-xs text-gray-500">
            お振込後、下の各請求の「振り込みました」を押すと教室に報告されます。
          </p>
        </div>
      )}

      {invoices.length === 0 && <p className="text-sm text-gray-500">請求書はまだありません。</p>}
      <ul className="flex flex-col gap-3">
        {invoices.map((inv) => {
          const s = statusLabel(inv);
          return (
            <li key={inv.id} className="rounded border p-3 text-sm">
              <p className="font-semibold">
                {inv.student_name} / {inv.year_month}
              </p>
              <p>
                ¥{inv.total.toLocaleString("ja-JP")}(
                <span className={s.className}>{s.text}</span>)
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => openPrintView(inv.id)}
                  className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
                >
                  請求書を表示
                </button>
                {inv.paid_status !== "入金済" && !inv.payment_reported_at && bank && (
                  <button
                    onClick={() => reportPayment(inv.id)}
                    disabled={reporting === inv.id}
                    className="rounded bg-black px-3 py-1 text-xs text-white disabled:opacity-50"
                  >
                    {reporting === inv.id ? "報告中..." : "振り込みました"}
                  </button>
                )}
                {inv.payment_reported_at && inv.paid_status !== "入金済" && (
                  <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
                    報告済み(教室の確認待ち)
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
