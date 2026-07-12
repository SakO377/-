"use client";

import { useEffect, useState } from "react";

// 調査用の一時的なページ(原因判明後に削除する)。
// useLiffのlogLocalがlocalStorageに残した記録を、通信不要でそのまま表示する。
export default function DebugPage() {
  const [log, setLog] = useState<string>("(読み込み中)");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("liff_debug_log");
      setLog(raw ? JSON.stringify(JSON.parse(raw), null, 2) : "(記録がありません)");
    } catch (err) {
      setLog(`読み取りエラー: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-3 text-lg font-bold">デバッグログ</h1>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded border bg-gray-50 p-3 text-xs">
        {log}
      </pre>
    </main>
  );
}
