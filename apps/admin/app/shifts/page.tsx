"use client";

import { useEffect, useState, type FormEvent } from "react";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch } from "@/lib/api";

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface ShiftRow {
  id: string;
  staff_id: string;
  staff_name: string;
  date: string;
  start_time: string;
  end_time: string;
  note: string | null;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function ShiftsView() {
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    staff_id: "",
    date: todayStr(),
    start_time: "16:00",
    end_time: "18:00",
    note: "",
  });

  async function load() {
    try {
      const shiftsRes = await apiFetch<{ shifts: ShiftRow[] }>("/api/shifts");
      setShifts(shiftsRes.shifts);
      try {
        const staffRes = await apiFetch<{ staff: StaffMember[] }>("/api/staff");
        setStaff(staffRes.staff);
        setForm((f) => (f.staff_id ? f : { ...f, staff_id: staffRes.staff[0]?.id ?? "" }));
      } catch {
        // staff一覧はオーナーのみ。取得できない場合は既存シフトの閲覧のみ。
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addShift(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch("/api/shifts", {
        method: "POST",
        body: JSON.stringify({
          staff_id: form.staff_id,
          date: form.date,
          start_time: form.start_time,
          end_time: form.end_time,
          note: form.note || null,
        }),
      });
      setForm({ ...form, note: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("このシフトを削除しますか?")) return;
    await apiFetch(`/api/shifts/${id}`, { method: "DELETE" });
    load();
  }

  // 日付ごとにまとめて表示する
  const grouped = shifts.reduce<Record<string, ShiftRow[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-xl font-bold">講師シフト</h1>
      <p className="mb-4 text-sm text-gray-500">
        講師の勤務予定を登録・共有します(給与計算は含みません)。
      </p>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <section className="mb-8">
        <h2 className="mb-2 font-semibold">シフトを追加</h2>
        {staff.length === 0 ? (
          <p className="text-sm text-gray-500">
            講師の登録が必要です(「スタッフ」から追加してください)。
          </p>
        ) : (
          <form onSubmit={addShift} className="flex flex-wrap items-end gap-2">
            <select
              className="rounded border px-3 py-2 text-sm"
              value={form.staff_id}
              onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="rounded border px-3 py-2 text-sm"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
            <input
              type="time"
              className="rounded border px-3 py-2 text-sm"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              required
            />
            <span className="text-gray-400">〜</span>
            <input
              type="time"
              className="rounded border px-3 py-2 text-sm"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              required
            />
            <input
              className="min-w-[140px] flex-1 rounded border px-3 py-2 text-sm"
              placeholder="メモ(担当クラス等)"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
            <button type="submit" className="rounded bg-black px-3 py-2 text-sm text-white">
              追加
            </button>
          </form>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">予定一覧</h2>
        {shifts.length === 0 && <p className="text-sm text-gray-500">まだシフトがありません。</p>}
        <div className="flex flex-col gap-4">
          {Object.keys(grouped)
            .sort()
            .map((date) => (
              <div key={date}>
                <p className="mb-1 text-sm font-semibold text-gray-700">{date}</p>
                <ul className="flex flex-col gap-1">
                  {grouped[date].map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="font-medium">{s.staff_name}</span>{" "}
                        {s.start_time}〜{s.end_time}
                        {s.note ? <span className="ml-2 text-gray-400">{s.note}</span> : null}
                      </span>
                      <button
                        onClick={() => remove(s.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        削除
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      </section>
    </main>
  );
}

export default function ShiftsPage() {
  return (
    <AuthGuard>
      <NavBar />
      <ShiftsView />
    </AuthGuard>
  );
}
