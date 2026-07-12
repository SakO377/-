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
          // 既定では登録済みのエンドポイントURL(トップページ)に戻ってしまうことがあるため、
          // 現在いたページのURLを明示的に指定してログイン後の戻り先を固定する。
          liff.login({ redirectUri: window.location.href });
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
