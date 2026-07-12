"use client";

import { useEffect, useState } from "react";
import liff from "@line/liff";

export type LiffStatus = "initializing" | "ready" | "error";

const DEBUG_KEY = "liff_debug_log";

// 調査用の一時的なログ(原因判明後に削除する)。ネットワーク不要でlocalStorageに残す。
// LINEアプリ内WebViewでは通信が届かないケースがあったため、同一オリジンの
// localStorageに書き、専用の /debug ページで後から確認できるようにする。
export function logLocal(step: string, extra: Record<string, unknown> = {}) {
  try {
    const raw = window.localStorage.getItem(DEBUG_KEY);
    const list: unknown[] = raw ? JSON.parse(raw) : [];
    list.push({ step, ...extra, url: window.location.href, time: new Date().toISOString() });
    window.localStorage.setItem(DEBUG_KEY, JSON.stringify(list.slice(-30)));
  } catch {
    // localStorageが使えない環境でも致命的にしない
  }
}

export function useLiff() {
  const [status, setStatus] = useState<LiffStatus>("initializing");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    logLocal("effect-start");

    async function init() {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) {
        logLocal("no-liff-id");
        setError("NEXT_PUBLIC_LIFF_ID が設定されていません。");
        setStatus("error");
        return;
      }
      try {
        logLocal("before-liff-init", { liffId });
        await liff.init({ liffId });
        const isInClient = liff.isInClient();
        const isLoggedIn = liff.isLoggedIn();
        logLocal("after-init", { isInClient, isLoggedIn, os: liff.getOS?.() });
        if (!isLoggedIn) {
          if (isInClient) {
            // LINEアプリ内(isInClient)では本来ログイン済みのはずで、ここに来るのは異常なケース。
            // login()を呼ぶとLIFF画面が閉じ直されてループする問題が起きるため、呼ばずにエラー表示する。
            logLocal("in-client-not-logged-in-abort");
            setError(
              "LINEアプリ内での認証状態を確認できませんでした(in-client未ログイン)。時間をおいて再度お試しいただくか、運営にご連絡ください。"
            );
            setStatus("error");
            return;
          }
          // 既定では登録済みのエンドポイントURL(トップページ)に戻ってしまうことがあるため、
          // 現在いたページのURLを明示的に指定してログイン後の戻り先を固定する。
          logLocal("calling-login", { redirectUri: window.location.href });
          liff.login({ redirectUri: window.location.href });
          return;
        }
        setStatus("ready");
      } catch (err) {
        const message = err instanceof Error ? err.message : "LIFFの初期化に失敗しました";
        logLocal("exception", { message });
        setError(message);
        setStatus("error");
      }
    }
    init();
  }, []);

  return { status, error, liff };
}
