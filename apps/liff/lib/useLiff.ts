"use client";

import { useEffect, useState } from "react";
import liff from "@line/liff";
import { API_BASE_URL } from "./api";

export type LiffStatus = "initializing" | "ready" | "error";

// 調査用の一時的なデバッグ送信(原因判明後に削除する)。失敗しても無視する。
function sendDebug(info: Record<string, unknown>) {
  fetch(`${API_BASE_URL}/liff/debug`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...info, url: window.location.href, time: new Date().toISOString() }),
  }).catch(() => {});
}

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
        const isInClient = liff.isInClient();
        const isLoggedIn = liff.isLoggedIn();
        sendDebug({ step: "after-init", isInClient, isLoggedIn, os: liff.getOS?.() });
        if (!isLoggedIn) {
          // 既定では登録済みのエンドポイントURL(トップページ)に戻ってしまうことがあるため、
          // 現在いたページのURLを明示的に指定してログイン後の戻り先を固定する。
          sendDebug({ step: "calling-login", redirectUri: window.location.href });
          liff.login({ redirectUri: window.location.href });
          return;
        }
        setStatus("ready");
      } catch (err) {
        const message = err instanceof Error ? err.message : "LIFFの初期化に失敗しました";
        sendDebug({ step: "exception", message });
        setError(message);
        setStatus("error");
      }
    }
    init();
  }, []);

  return { status, error, liff };
}
