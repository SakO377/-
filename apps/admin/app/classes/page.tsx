"use client";

import { useEffect, useState, type FormEvent } from "react";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch } from "@/lib/api";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// 全角数字(０-９)を半角に変換し、数字以外を除去する。
// スマホのIMEで全角数字が入りがちな定員入力を、そのまま扱えるようにする。
function toHalfWidthDigits(value: string): string {
  return value
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9]/g, "");
}

interface ClassRow {
  id: string;
  name: string;
  weekday: number;
  start_time: string;
  end_time: string;
  capacity: number | null;
  enrolled: number;
  archived_at?: string | null;
}

function seatsLabel(c: ClassRow): { text: string; alert: boolean } {
  if (c.capacity == null) return { text: `${c.enrolled}名(定員未設定)`, alert: false };
  const remaining = c.capacity - c.enrolled;
  return {
    text: remaining > 0 ? `空き ${remaining}(${c.enrolled}/${c.capacity})` : `満席(${c.enrolled}/${c.capacity})`,
    alert: remaining <= 0,
  };
}

interface EditForm {
  name: string;
  weekday: string;
  start_time: string;
  end_time: string;
  capacity: string;
}

function ClassesView() {
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [archived, setArchived] = useState<ClassRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    weekday: "1",
    start_time: "",
    end_time: "",
    capacity: "",
  });
  const [form, setForm] = useState({
    name: "",
    weekday: "1",
    start_time: "16:00",
    end_time: "17:00",
    capacity: "",
  });

  async function load() {
    try {
      const [activeRes, archivedRes] = await Promise.all([
        apiFetch<{ classes: ClassRow[] }>("/api/classes"),
        apiFetch<{ classes: ClassRow[] }>("/api/classes?archived=1"),
      ]);
      setClasses(activeRes.classes);
      setArchived(archivedRes.classes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(c: ClassRow) {
    setEditingId(c.id);
    setEditForm({
      name: c.name,
      weekday: String(c.weekday),
      start_time: c.start_time,
      end_time: c.end_time,
      capacity: c.capacity != null ? String(c.capacity) : "",
    });
  }

  async function saveEdit(id: string) {
    try {
      await apiFetch(`/api/classes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name,
          weekday: Number(editForm.weekday),
          start_time: editForm.start_time,
          end_time: editForm.end_time,
          capacity: editForm.capacity ? Number(editForm.capacity) : null,
        }),
      });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    }
  }

  async function archiveClass(c: ClassRow) {
    if (
      !window.confirm(
        `クラス「${c.name}」を削除しますか?\n過去の記録は残り、「過去にあったクラス」から確認できます。`
      )
    )
      return;
    try {
      await apiFetch(`/api/classes/${c.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  }

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
                <th className="py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => {
                const s = seatsLabel(c);
                if (editingId === c.id) {
                  return (
                    <tr key={c.id} className="border-b bg-gray-50 align-top">
                      <td className="py-2">
                        <input
                          className="w-full rounded border px-2 py-1 text-sm"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      </td>
                      <td className="py-2">
                        <select
                          className="rounded border px-2 py-1 text-sm"
                          value={editForm.weekday}
                          onChange={(e) => setEditForm({ ...editForm, weekday: e.target.value })}
                        >
                          {WEEKDAYS.map((w, i) => (
                            <option key={w} value={i}>
                              {w}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="time"
                            className="rounded border px-1 py-1 text-xs"
                            value={editForm.start_time}
                            onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                          />
                          <input
                            type="time"
                            className="rounded border px-1 py-1 text-xs"
                            value={editForm.end_time}
                            onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                          />
                        </div>
                      </td>
                      <td className="py-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          className="w-16 rounded border px-2 py-1 text-sm"
                          placeholder="定員"
                          value={editForm.capacity}
                          onChange={(e) =>
                            setEditForm({ ...editForm, capacity: toHalfWidthDigits(e.target.value) })
                          }
                        />
                      </td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(c.id)}
                            className="rounded bg-black px-2 py-1 text-xs text-white"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs text-gray-500 hover:underline"
                          >
                            取消
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }
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
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(c)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => archiveClass(c)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          削除
                        </button>
                      </div>
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
          type="text"
          inputMode="numeric"
          className="w-24 rounded border px-3 py-2"
          placeholder="定員"
          value={form.capacity}
          onChange={(e) => setForm({ ...form, capacity: toHalfWidthDigits(e.target.value) })}
        />
        <button type="submit" className="rounded bg-black px-4 py-2 text-sm text-white">
          追加
        </button>
      </form>
      <p className="mt-2 text-xs text-gray-500">
        ※定員は半角数字で入力してください(全角で入力しても自動的に半角に変換されます)。
      </p>

      {archived.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 font-semibold text-gray-600">過去にあったクラス</h2>
          <p className="mb-2 text-xs text-gray-500">
            削除したクラスの記録です。過去の欠席・振替・請求の記録はそのまま残ります。
          </p>
          <table className="w-full border-collapse text-sm text-gray-500">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1.5">名称</th>
                <th className="py-1.5">曜日</th>
                <th className="py-1.5">時間</th>
                <th className="py-1.5">削除日</th>
              </tr>
            </thead>
            <tbody>
              {archived.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="py-1.5">{c.name}</td>
                  <td className="py-1.5">{WEEKDAYS[c.weekday]}</td>
                  <td className="py-1.5">
                    {c.start_time} - {c.end_time}
                  </td>
                  <td className="py-1.5">{c.archived_at ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
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
