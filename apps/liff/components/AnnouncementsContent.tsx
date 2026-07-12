"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiff } from "@/lib/useLiff";
import { apiFetch, ApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import NotLinkedNotice from "@/components/NotLinkedNotice";

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
}

export default function AnnouncementsContent({
  onBack,
  onGoToLink,
}: {
  onBack: () => void;
  onGoToLink: () => void;
}) {
  const { status, error: liffError, liff } = useLiff();
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notLinked, setNotLinked] = useState(false);

  const authHeader = useCallback((): Record<string, string> => {
    const idToken = liff.getIDToken();
    return idToken ? { Authorization: `Bearer ${idToken}` } : {};
  }, [liff]);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ announcements: AnnouncementRow[] }>("/liff/announcements", {
        headers: authHeader(),
      });
      setAnnouncements(res.announcements);
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

  async function markRead(id: string) {
    await apiFetch(`/liff/announcements/${id}/read`, { method: "POST", headers: authHeader() });
    load();
  }

  if (status === "initializing") return <p className="text-center text-gray-500">読み込み中...</p>;
  if (status === "error") return <p className="text-center text-red-600">{liffError}</p>;
  if (notLinked) {
    return (
      <div>
        <PageHeader title="お知らせ" onBack={onBack} />
        <NotLinkedNotice onGoToLink={onGoToLink} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="お知らせ" onBack={onBack} />
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {announcements.length === 0 && <p className="text-sm text-gray-500">お知らせはまだありません。</p>}
      <ul className="flex flex-col gap-3">
        {announcements.map((a) => (
          <li
            key={a.id}
            onClick={() => !a.read_at && markRead(a.id)}
            className="rounded border p-3 text-sm"
          >
            <p className="font-semibold">{a.title}</p>
            <p className="mt-1 whitespace-pre-wrap">{a.body}</p>
            <p className="mt-1 text-xs text-gray-500">{a.read_at ? "既読" : "未読(タップで既読)"}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
