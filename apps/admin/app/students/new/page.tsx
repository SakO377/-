"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch } from "@/lib/api";

const GRADE_PRESETS = [
  "年少",
  "年中",
  "年長",
  "小1",
  "小2",
  "小3",
  "小4",
  "小5",
  "小6",
  "中1",
  "中2",
  "中3",
  "高1",
  "高2",
  "高3",
];
const GRADE_CUSTOM = "__custom__";

function NewStudentForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", grade: "", course: "" });
  const [gradeMode, setGradeMode] = useState<"preset" | typeof GRADE_CUSTOM>("preset");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function addTag() {
    const value = tagInput.trim();
    if (!value || tags.includes(value)) {
      setTagInput("");
      return;
    }
    setTags([...tags, value]);
    setTagInput("");
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const student = await apiFetch<{ id: string }>("/api/students", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          grade: form.grade || null,
          course: form.course || null,
          tags,
        }),
      });
      router.push(`/students/detail?id=${student.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-xl font-bold">生徒の新規登録</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          className="rounded border px-3 py-2"
          placeholder="氏名"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-600">学年</label>
          <select
            className="rounded border px-3 py-2"
            value={gradeMode === GRADE_CUSTOM ? GRADE_CUSTOM : form.grade}
            onChange={(e) => {
              if (e.target.value === GRADE_CUSTOM) {
                setGradeMode(GRADE_CUSTOM);
                setForm({ ...form, grade: "" });
              } else {
                setGradeMode("preset");
                setForm({ ...form, grade: e.target.value });
              }
            }}
          >
            <option value="">選択してください</option>
            {GRADE_PRESETS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
            <option value={GRADE_CUSTOM}>その他(自由入力)</option>
          </select>
          {gradeMode === GRADE_CUSTOM && (
            <input
              className="rounded border px-3 py-2"
              placeholder="学年を入力(例: 高卒認定クラス)"
              value={form.grade}
              onChange={(e) => setForm({ ...form, grade: e.target.value })}
            />
          )}
        </div>

        <input
          className="rounded border px-3 py-2"
          placeholder="コース"
          value={form.course}
          onChange={(e) => setForm({ ...form, course: e.target.value })}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-600">タグ</label>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-gray-500 hover:text-red-600"
                    aria-label={`${tag}を削除`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="タグを入力してEnter(例: 兄弟在籍、体験)"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
            />
            <button
              type="button"
              onClick={addTag}
              className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
            >
              追加
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "登録中..." : "登録する"}
        </button>
      </form>
    </main>
  );
}

export default function NewStudentPage() {
  return (
    <AuthGuard>
      <NavBar />
      <NewStudentForm />
    </AuthGuard>
  );
}
