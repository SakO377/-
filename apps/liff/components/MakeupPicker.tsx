"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

interface MakeupOption {
  class_id: string;
  class_name: string;
  date: string;
  weekday: number;
  start_time: string;
  end_time: string;
  remaining: number | null;
}

export default function MakeupPicker({
  absenceId,
  authHeader,
  onDone,
  onCancel,
}: {
  absenceId: string;
  authHeader: () => Record<string, string>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [options, setOptions] = useState<MakeupOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ options: MakeupOption[] }>(`/liff/absences/${absenceId}/makeup-options`, {
      headers: authHeader(),
    })
      .then((res) => setOptions(res.options))
      .catch((err) => setError(err instanceof Error ? err.message : "読み込みに失敗しました"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [absenceId]);

  async function select(opt: MakeupOption) {
    const key = `${opt.class_id}|${opt.date}`;
    setSubmitting(key);
    setError(null);
    try {
      await apiFetch(`/liff/absences/${absenceId}/select-makeup`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ class_id: opt.class_id, date: opt.date }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "予約に失敗しました");
      setSubmitting(null);
    }
  }

  return (
    <div className="rounded border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">空いている振替枠から選ぶ</h3>
        <button onClick={onCancel} className="text-sm text-gray-500 hover:underline">
          閉じる
        </button>
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {options === null && <p className="text-sm text-gray-500">読み込み中...</p>}
      {options !== null && options.length === 0 && (
        <p className="text-sm text-gray-500">
          今後4週間で空きのある枠が見つかりませんでした。教室までお問い合わせください。
        </p>
      )}
      {options !== null && options.length > 0 && (
        <ul className="flex flex-col gap-2">
          {options.map((o) => {
            const key = `${o.class_id}|${o.date}`;
            return (
              <li key={key} className="flex items-center justify-between rounded border p-2 text-sm">
                <span>
                  {o.date}({WEEKDAYS[o.weekday]}) {o.start_time}〜{o.end_time} {o.class_name}
                  {o.remaining !== null && (
                    <span className="ml-2 text-xs text-gray-500">空き{o.remaining}</span>
                  )}
                </span>
                <button
                  onClick={() => select(o)}
                  disabled={submitting !== null}
                  className="rounded bg-black px-3 py-1 text-xs text-white disabled:opacity-50"
                >
                  {submitting === key ? "予約中..." : "この枠にする"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
