"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch } from "@/lib/api";

interface SettingsData {
  attendance_push_enabled: boolean;
  inquiry_auto_reply_enabled: boolean;
  inquiry_auto_reply_text: string;
  enrollment_guide_text: string;
  line_quota: { used: number; quota: number; remaining: number };
}

function SettingsView() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function load() {
    try {
      setData(await apiFetch<SettingsData>("/api/settings"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(patch: Partial<SettingsData>) {
    setSaved(false);
    const res = await apiFetch<SettingsData>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setData(res);
    setSaved(true);
  }

  if (error) return <main className="p-6 text-red-600">{error}</main>;
  if (!data) return <main className="p-6 text-gray-500">読み込み中...</main>;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-bold">設定</h1>
      {saved && <p className="mb-3 text-sm text-green-600">保存しました</p>}

      <section className="mb-6 rounded-lg border p-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.attendance_push_enabled}
            onChange={(e) => save({ attendance_push_enabled: e.target.checked })}
          />
          <span className="font-medium">入退室時にLINEで保護者へ通知する</span>
        </label>
        <p className="mt-1 text-sm text-gray-500">
          QRチェックイン時に保護者へ入室のお知らせを送ります(無料枠を消費します)。
        </p>
      </section>

      <section className="mb-6 rounded-lg border p-4">
        <h2 className="mb-2 font-semibold">問い合わせの一次自動応答(LINE)</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.inquiry_auto_reply_enabled}
            onChange={(e) => save({ inquiry_auto_reply_enabled: e.target.checked })}
          />
          <span>公式アカウントへのメッセージに自動で一次返信する</span>
        </label>
        <p className="mt-1 mb-2 text-sm text-gray-500">
          保護者からのメッセージにすぐ定型文で返信します(応答メッセージは無料枠を消費しません)。
        </p>
        <textarea
          className="w-full rounded border px-3 py-2 text-sm"
          rows={3}
          placeholder="例: お問い合わせありがとうございます。担当より順次ご連絡いたします。体験のお申し込みはこちら → ..."
          defaultValue={data.inquiry_auto_reply_text}
          onBlur={(e) => save({ inquiry_auto_reply_text: e.target.value })}
        />
        <p className="text-xs text-gray-400">入力後、枠の外をクリックすると保存されます。</p>
      </section>

      <section className="mb-6 rounded-lg border p-4">
        <h2 className="mb-2 font-semibold">入会案内の自動送付(LINE友だち追加時)</h2>
        <p className="mb-2 text-sm text-gray-500">
          友だち追加してくれた方へ、招待コードの案内に続けて自動で送るメッセージです(空欄なら送りません)。
        </p>
        <textarea
          className="w-full rounded border px-3 py-2 text-sm"
          rows={3}
          placeholder="例: 入会をご検討の方へ。料金・時間割のご案内はこちら → ..."
          defaultValue={data.enrollment_guide_text}
          onBlur={(e) => save({ enrollment_guide_text: e.target.value })}
        />
        <p className="text-xs text-gray-400">入力後、枠の外をクリックすると保存されます。</p>
      </section>

      <section className="rounded-lg border p-4 text-sm text-gray-600">
        LINE無料メッセージ枠(今月): {data.line_quota.used} / {data.line_quota.quota} 通(残り{" "}
        {data.line_quota.remaining} 通)
      </section>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <NavBar />
      <SettingsView />
    </AuthGuard>
  );
}
