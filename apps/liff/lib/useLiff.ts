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
        const isInClient = liff.isInClient();
        if (!liff.isLoggedIn()) {
          if (isInClient) {
            // LINEアプリ内では本来ログイン済みのはずのため、ここに来るのは異常なケース。
            // login()を呼ぶとLIFF画面が閉じ直されて元の画面に戻ってしまう問題があるため、
            // 呼ばずにエラー表示に留める。
            setError(
              "LINEアプリ内での認証状態を確認できませんでした。時間をおいて再度お試しいただくか、運営にご連絡ください。"
            );
            setStatus("error");
            return;
          }
          // 外部ブラウザの場合のみログイン画面へ遷移する。既定では登録済みの
          // エンドポイントURLに戻ってしまうことがあるため、現在のURLを明示する。
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
