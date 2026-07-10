"use client";

import { useEffect, useState, type FormEvent } from "react";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch } from "@/lib/api";
import type { ClassEntity } from "@school-harness/shared";

type SegmentType = "all" | "class" | "tag";

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  segment: { type: SegmentType; class_id?: string; tag?: string };
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
}

function AnnouncementsView() {
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    body: "",
    segmentType: "all" as SegmentType,
    classId: "",
    tag: "",
    scheduledAt: "",
  });

  async function load() {
    try {
      const [announcementsRes, classesRes] = await Promise.all([
        apiFetch<{ announcements: AnnouncementRow[] }>("/api/announcements"),
        apiFetch<{ classes: ClassEntity[] }>("/api/classes"),
      ]);
      setAnnouncements(announcementsRes.announcements);
      setClasses(classesRes.classes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const segment =
      form.segmentType === "class"
        ? { type: "class", class_id: form.classId }
        : form.segmentType === "tag"
          ? { type: "tag", tag: form.tag }
          : { type: "all" };
    try {
      await apiFetch("/api/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          segment,
          scheduled_at: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        }),
      });
      setForm({ title: "", body: "", segmentType: "all", classId: "", tag: "", scheduledAt: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    }
  }

  function segmentLabel(segment: AnnouncementRow["segment"]) {
    if (segment.type === "all") return "全体";
    if (segment.type === "class") {
      const cls = classes.find((c) => c.id === segment.class_id);
      return `クラス: ${cls?.name ?? segment.class_id}`;
    }
    return `タグ: ${segment.tag}`;
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-bold">お知らせ配信</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="mb-8">
        <h2 className="mb-2 font-semibold">新規作成</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            className="rounded border px-3 py-2"
            placeholder="タイトル"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <textarea
            className="rounded border px-3 py-2"
            rows={4}
            placeholder="本文"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            required
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded border px-3 py-2"
              value={form.segmentType}
              onChange={(e) => setForm({ ...form, segmentType: e.target.value as SegmentType })}
            >
              <option value="all">配信対象: 全体</option>
              <option value="class">配信対象: クラス別</option>
              <option value="tag">配信対象: タグ別</option>
            </select>
            {form.segmentType === "class" && (
              <select
                className="rounded border px-3 py-2"
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value })}
                required
              >
                <option value="">クラスを選択</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            {form.segmentType === "tag" && (
              <input
                className="rounded border px-3 py-2"
                placeholder="タグ名"
                value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value })}
                required
              />
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            予約配信日時(任意、空欄の場合は即時配信)
            <input
              type="datetime-local"
              className="rounded border px-3 py-2"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            />
          </label>
          <button type="submit" className="rounded bg-black px-4 py-2 text-white">
            {form.scheduledAt ? "予約する" : "今すぐ配信する"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">配信履歴</h2>
        {announcements.length === 0 && (
          <p className="text-sm text-gray-500">まだお知らせがありません。</p>
        )}
        {announcements.length > 0 && (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">タイトル</th>
                <th className="py-2">配信対象</th>
                <th className="py-2">状態</th>
              </tr>
            </thead>
            <tbody>
              {announcements.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="py-2">{a.title}</td>
                  <td className="py-2">{segmentLabel(a.segment)}</td>
                  <td className="py-2">
                    {a.sent_at
                      ? `送信済み(${a.sent_at})`
                      : a.scheduled_at
                        ? `予約中(${a.scheduled_at})`
                        : "未送信"}
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

export default function AnnouncementsPage() {
  return (
    <AuthGuard>
      <NavBar />
      <AnnouncementsView />
    </AuthGuard>
  );
}
