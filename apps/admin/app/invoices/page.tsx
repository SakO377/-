"use client";

import { useEffect, useState, type FormEvent } from "react";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch, getApiKey, API_BASE_URL } from "@/lib/api";
import type { Student } from "@school-harness/shared";

interface InvoiceItem {
  label: string;
  amount: number;
}

// 編集中の明細。percent を持つ行は「割合割引」で、金額は他の項目合計から自動計算する。
interface EditableItem {
  label: string;
  amount: number;
  percent?: number;
}

interface InvoiceRow {
  id: string;
  student_name: string;
  year_month: string;
  items: InvoiceItem[];
  total: number;
  paid_status: "未入金" | "入金済" | "一部入金";
  sent_at: string | null;
}

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function InvoicesView() {
  const [students, setStudents] = useState<Student[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState("");
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [items, setItems] = useState<EditableItem[]>([{ label: "月謝", amount: 0 }]);

  async function load() {
    try {
      const [studentsRes, invoicesRes] = await Promise.all([
        apiFetch<{ students: Student[] }>("/api/students"),
        apiFetch<{ invoices: InvoiceRow[] }>("/api/invoices"),
      ]);
      setStudents(studentsRes.students);
      setInvoices(invoicesRes.invoices);
      // 初期選択の生徒の月謝を明細に反映する(未選択時のみ)
      setStudentId((id) => {
        const nextId = id || studentsRes.students[0]?.id || "";
        if (!id) {
          const first = studentsRes.students.find((s) => s.id === nextId);
          if (first?.monthly_fee) setItems([{ label: "月謝", amount: first.monthly_fee }]);
        }
        return nextId;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    }
  }

  useEffect(() => {
    load();
  }, []);

  function selectStudent(id: string) {
    setStudentId(id);
    const student = students.find((s) => s.id === id);
    if (student?.monthly_fee) {
      setItems([{ label: "月謝", amount: student.monthly_fee }]);
    }
  }

  function updateItem(index: number, patch: Partial<EditableItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { label: "", amount: 0 }]);
  }

  function addPercentDiscount() {
    setItems((prev) => [...prev, { label: "割引", amount: 0, percent: 10 }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // 割合割引の基準額(percentを持たない項目の合計)
  const baseAmount = items
    .filter((it) => it.percent === undefined)
    .reduce((sum, it) => sum + (Number.isFinite(it.amount) ? it.amount : 0), 0);

  // 編集中の明細を、実際に送信・表示する {label, amount} に確定する。
  // 割合割引は基準額から金額を計算し、ラベルに割合を明記する。
  function resolveItem(it: EditableItem): InvoiceItem {
    if (it.percent !== undefined) {
      const pct = Number.isFinite(it.percent) ? it.percent : 0;
      const base = it.label.trim() || "割引";
      return { label: `${base} (${pct}%)`, amount: -Math.round((baseAmount * pct) / 100) };
    }
    return { label: it.label, amount: Number.isFinite(it.amount) ? it.amount : 0 };
  }

  const computedItems = items.map(resolveItem);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch("/api/invoices", {
        method: "POST",
        body: JSON.stringify({ student_id: studentId, year_month: yearMonth, items: computedItems }),
      });
      setItems([{ label: "月謝", amount: 0 }]);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    }
  }

  async function markPaid(id: string) {
    await apiFetch(`/api/invoices/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ paid_status: "入金済", paid_at: new Date().toISOString() }),
    });
    load();
  }

  async function sendInvoice(id: string) {
    await apiFetch(`/api/invoices/${id}/send`, { method: "POST" });
    load();
  }

  async function openPrintView(id: string) {
    const apiKey = getApiKey();
    const res = await fetch(`${API_BASE_URL}/api/invoices/${id}/print`, {
      headers: apiKey ? { "X-API-Key": apiKey } : {},
    });
    const html = await res.text();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  const total = computedItems.reduce((sum, item) => sum + item.amount, 0);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-bold">月謝・請求</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="mb-8">
        <h2 className="mb-2 font-semibold">請求書を作成</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <select
              className="flex-1 rounded border px-3 py-2"
              value={studentId}
              onChange={(e) => selectStudent(e.target.value)}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="month"
              className="rounded border px-3 py-2"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="flex-1 rounded border px-3 py-2 text-sm"
                  placeholder={item.percent !== undefined ? "割引名(例: 兄弟割引)" : "項目名(例: 月謝、教材費)"}
                  value={item.label}
                  onChange={(e) => updateItem(i, { label: e.target.value })}
                  required
                />
                {item.percent !== undefined ? (
                  <div className="flex w-32 items-center gap-1">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      className="w-16 rounded border px-2 py-2 text-sm"
                      value={item.percent}
                      onChange={(e) => updateItem(i, { percent: Number(e.target.value) })}
                      required
                    />
                    <span className="text-sm text-gray-500">%</span>
                    <span className="ml-auto text-xs text-gray-500">
                      {resolveItem(item).amount.toLocaleString("ja-JP")}
                    </span>
                  </div>
                ) : (
                  <input
                    type="number"
                    step="100"
                    className="w-32 rounded border px-3 py-2 text-sm"
                    value={item.amount}
                    onChange={(e) => updateItem(i, { amount: Number(e.target.value) })}
                    required
                  />
                )}
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="rounded border px-2 text-sm text-red-600"
                  >
                    削除
                  </button>
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                onClick={addItem}
                className="text-sm text-blue-600 hover:underline"
              >
                + 項目を追加(定額の割引はマイナス金額で入力)
              </button>
              <button
                type="button"
                onClick={addPercentDiscount}
                className="text-sm text-blue-600 hover:underline"
              >
                + 割引(％)を追加
              </button>
            </div>
          </div>

          <p className="text-right font-semibold">合計: ¥{total.toLocaleString("ja-JP")}</p>

          <button type="submit" className="rounded bg-black px-4 py-2 text-white">
            請求書を作成
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">請求書一覧</h2>
        {invoices.length === 0 && <p className="text-sm text-gray-500">まだ請求書がありません。</p>}
        {invoices.length > 0 && (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">対象月</th>
                <th className="py-2">生徒</th>
                <th className="py-2">金額</th>
                <th className="py-2">入金</th>
                <th className="py-2">送信</th>
                <th className="py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b align-top">
                  <td className="py-2">{inv.year_month}</td>
                  <td className="py-2">{inv.student_name}</td>
                  <td className="py-2">¥{inv.total.toLocaleString("ja-JP")}</td>
                  <td className="py-2">{inv.paid_status}</td>
                  <td className="py-2">{inv.sent_at ? "送信済み" : "未送信"}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => openPrintView(inv.id)}
                        className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                      >
                        印刷/PDF保存
                      </button>
                      {!inv.sent_at && (
                        <button
                          onClick={() => sendInvoice(inv.id)}
                          className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                        >
                          LINEで送信
                        </button>
                      )}
                      {inv.paid_status !== "入金済" && (
                        <button
                          onClick={() => markPaid(inv.id)}
                          className="rounded bg-black px-2 py-1 text-xs text-white"
                        >
                          入金済みにする
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

export default function InvoicesPage() {
  return (
    <AuthGuard>
      <NavBar />
      <InvoicesView />
    </AuthGuard>
  );
}
