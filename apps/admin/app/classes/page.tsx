"use client";

import { useEffect, useState, type FormEvent } from "react";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch } from "@/lib/api";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

interface ClassRow {
  id: string;
  name: string;
  weekday: number;
  start_time: string;
  end_time: string;
  capacity: number | null;
  enrolled: number;
}

function seatsLabel(c: ClassRow): { text: string; alert: boolean } {
  if (c.capacity == null) return { text: `${c.enrolled}名(定員未設定)`, alert: false };
  const remaining = c.capacity - c.enrolled;
  return {
    text: remaining > 0 ? `空き ${remaining}(${c.enrolled}/${c.capacity})` : `満席(${c.enrolled}/${c.capacity})`,
    alert: remaining <= 0,
  };
}

function ClassesView() {
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    weekday: "1",
    start_time: "16:00",
    end_time: "17:00",
    capacity: "",
  });

  async function load() {
    try {
      const res = await apiFetch<{ classes: ClassRow[] }>("/api/classes");
      setClasses(res.classes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch("/api/classes", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          weekday: Number(form.weekday),
          start_time: form.start_time,
          end_time: form.end_time,
          capacity: form.capacity ? Number(form.capacity) : null,
        }),
      });
      setForm({ name: "", weekday: "1", start_time: "16:00", end_time: "17:00", capacity: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-bold">クラス一覧</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {classes && classes.length === 0 && (
        <p className="mb-6 text-gray-500">まだクラスが登録されていません。</p>
      )}
      {classes && classes.length > 0 && (
        <>
          <table className="mb-6 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">名称</th>
                <th className="py-2">曜日</th>
                <th className="py-2">時間</th>
                <th className="py-2">在籍 / 定員(空き)</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => {
                const s = seatsLabel(c);
                return (
                  <tr key={c.id} className="border-b">
                    <td className="py-2">{c.name}</td>
                    <td className="py-2">{WEEKDAYS[c.weekday]}</td>
                    <td className="py-2">
                      {c.start_time} - {c.end_time}
                    </td>
                    <td className={`py-2 ${s.alert ? "font-semibold text-red-600" : ""}`}>
                      {s.text}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h2 className="mb-2 font-semibold">週間時間割(空き枠)</h2>
          <div className="mb-6 overflow-x-auto">
            <div className="grid min-w-[640px] grid-cols-7 gap-2">
              {WEEKDAYS.map((w, day) => (
                <div key={w} className="flex flex-col gap-1">
                  <div className="text-center text-xs font-semibold text-gray-500">{w}</div>
                  {classes
                    .filter((c) => c.weekday === day)
                    .map((c) => {
                      const s = seatsLabel(c);
                      return (
                        <div
                          key={c.id}
                          className={`rounded border p-1.5 text-xs ${
                            s.alert ? "border-red-200 bg-red-50" : "bg-gray-50"
                          }`}
                        >
                          <div className="font-medium">{c.name}</div>
                          <div className="text-gray-500">
                            {c.start_time}-{c.end_time}
                          </div>
                          <div className={s.alert ? "text-red-600" : "text-green-700"}>{s.text}</div>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <h2 className="mb-2 font-semibold">クラスを追加</h2>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <input
          className="rounded border px-3 py-2"
          placeholder="クラス名"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <select
          className="rounded border px-3 py-2"
          value={form.weekday}
          onChange={(e) => setForm({ ...form, weekday: e.target.value })}
        >
          {WEEKDAYS.map((w, i) => (
            <option key={w} value={i}>
              {w}曜日
            </option>
          ))}
        </select>
        <input
          type="time"
          className="rounded border px-3 py-2"
          value={form.start_time}
          onChange={(e) => setForm({ ...form, start_time: e.target.value })}
        />
        <input
          type="time"
          className="rounded border px-3 py-2"
          value={form.end_time}
          onChange={(e) => setForm({ ...form, end_time: e.target.value })}
        />
        <input
          type="number"
          className="w-24 rounded border px-3 py-2"
          placeholder="定員"
          value={form.capacity}
          onChange={(e) => setForm({ ...form, capacity: e.target.value })}
        />
        <button type="submit" className="rounded bg-black px-4 py-2 text-sm text-white">
          追加
        </button>
      </form>
    </main>
  );
}

export default function ClassesPage() {
  return (
    <AuthGuard>
      <NavBar />
      <ClassesView />
    </AuthGuard>
  );
}
