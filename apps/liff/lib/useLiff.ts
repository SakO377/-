"use client";

import { useEffect, useState } from "react";
import liff from "@line/liff";
import { API_BASE_URL } from "./api";

export type LiffStatus = "initializing" | "ready" | "error";

// 調査用の一時的なデバッグ送信(原因判明後に削除する)。
// login()等で画面が離脱する前に確実に送信できるよう、完了を待つ。
async function sendDebug(info: Record<string, unknown>) {
  try {
    await fetch(`${API_BASE_URL}/liff/debug`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...info, url: window.location.href, time: new Date().toISOString() }),
      keepalive: true,
    });
  } catch {
    // 送信失敗は無視(調査用のため)
  }
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
        await sendDebug({ step: "after-init", isInClient, isLoggedIn, os: liff.getOS?.() });
        if (!isLoggedIn) {
          if (isInClient) {
            // LINEアプリ内(isInClient)では本来ログイン済みのはずで、ここに来るのは異常なケース。
            // login()を呼ぶとLIFF画面が閉じ直されてループする問題が起きるため、呼ばずにエラー表示する。
            await sendDebug({ step: "in-client-not-logged-in-abort" });
            setError(
              "LINEアプリ内での認証状態を確認できませんでした(in-client未ログイン)。時間をおいて再度お試しいただくか、運営にご連絡ください。"
            );
            setStatus("error");
            return;
          }
          // 既定では登録済みのエンドポイントURL(トップページ)に戻ってしまうことがあるため、
          // 現在いたページのURLを明示的に指定してログイン後の戻り先を固定する。
          await sendDebug({ step: "calling-login", redirectUri: window.location.href });
          liff.login({ redirectUri: window.location.href });
          return;
        }
        setStatus("ready");
      } catch (err) {
        const message = err instanceof Error ? err.message : "LIFFの初期化に失敗しました";
        await sendDebug({ step: "exception", message });
        setError(message);
        setStatus("error");
      }
    }
    init();
  }, []);

  return { status, error, liff };
}
