"use client";

import { useEffect, useState } from "react";
import liff from "@line/liff";

export type LiffStatus = "initializing" | "ready" | "error";

export function useLiff() {
  const [status, setStatus] = useState<LiffStatus>("initializing");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) {
        setError("NEXT_PUBLIC_LIFF_ID が設定されていません。");
        setStatus("error");
        return;
      }
      try {
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        setStatus("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "LIFFの初期化に失敗しました");
        setStatus("error");
      }
    }
    init();
  }, []);

  return { status, error, liff };
}
