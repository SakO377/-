"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch, setApiKey } from "@/lib/api";

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
  const [password, setPassword] = useState("");
  const [pwMessage, setPwMessage] = useState<string | null>(null);

  // 2段階認証
  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
  const [recoveryRemaining, setRecoveryRemaining] = useState(0);
  const [totpSetup, setTotpSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpMessage, setTotpMessage] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");

  function refreshTotpStatus() {
    apiFetch<{ enabled: boolean; recovery_codes_remaining: number }>("/api/auth/totp/status")
      .then((r) => {
        setTotpEnabled(r.enabled);
        setRecoveryRemaining(r.recovery_codes_remaining);
      })
      .catch(() => setTotpEnabled(false));
  }

  useEffect(() => {
    refreshTotpStatus();
  }, []);

  async function startTotpSetup() {
    setTotpMessage(null);
    const res = await apiFetch<{ secret: string; otpauth_uri: string }>("/api/auth/totp/setup", {
      method: "POST",
    });
    const qr = await QRCode.toDataURL(res.otpauth_uri, { width: 180 });
    setTotpSetup({ secret: res.secret, qr });
  }

  async function enableTotp() {
    setTotpMessage(null);
    try {
      const res = await apiFetch<{ recovery_codes: string[] }>("/api/auth/totp/enable", {
        method: "POST",
        body: JSON.stringify({ code: totpCode.trim() }),
      });
      setTotpEnabled(true);
      setTotpSetup(null);
      setTotpCode("");
      setRecoveryCodes(res.recovery_codes);
      setTotpMessage("2段階認証を有効にしました。次回ログインからコードが必要です。");
      refreshTotpStatus();
    } catch (err) {
      setTotpMessage(err instanceof Error ? err.message : "有効化に失敗しました");
    }
  }

  async function regenerateRecoveryCodes() {
    const res = await apiFetch<{ recovery_codes: string[] }>("/api/auth/totp/recovery-codes", {
      method: "POST",
    });
    setRecoveryCodes(res.recovery_codes);
    refreshTotpStatus();
  }

  async function disableTotp() {
    setTotpMessage(null);
    try {
      await apiFetch("/api/auth/totp/disable", {
        method: "POST",
        body: JSON.stringify({ password: disablePassword }),
      });
      setTotpEnabled(false);
      setRecoveryCodes(null);
      setDisablePassword("");
      setTotpMessage("2段階認証を無効にしました。");
      refreshTotpStatus();
    } catch (err) {
      setTotpMessage(err instanceof Error ? err.message : "無効化に失敗しました");
    }
  }

  async function rotateKey() {
    if (
      !window.confirm(
        "現在のAPIキーを無効化し、新しいキーを発行します。他の端末でこのキーを使っている場合は再ログインが必要です。続けますか?"
      )
    )
      return;
    const res = await apiFetch<{ api_key: string }>("/api/auth/rotate-key", { method: "POST" });
    setApiKey(res.api_key);
    window.alert(`新しいAPIキー:\n${res.api_key}\n\nこの端末には自動で保存しました。安全に控えてください。`);
  }

  async function savePassword() {
    setPwMessage(null);
    if (password.length < 8) {
      setPwMessage("パスワードは8文字以上にしてください。");
      return;
    }
    try {
      await apiFetch("/api/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setPassword("");
      setPwMessage("パスワードを設定しました。次回から名前＋パスワードでログインできます。");
    } catch (err) {
      setPwMessage(err instanceof Error ? err.message : "設定に失敗しました");
    }
  }

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

      <section className="mb-6 rounded-lg border p-4">
        <h2 className="mb-2 font-semibold">ログイン用パスワードの設定</h2>
        <p className="mb-2 text-sm text-gray-500">
          パスワードを設定すると、APIキーの代わりに「お名前＋パスワード」でログインできます。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="password"
            className="rounded border px-3 py-2 text-sm"
            placeholder="新しいパスワード(8文字以上)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            onClick={savePassword}
            className="rounded bg-black px-3 py-2 text-sm text-white"
          >
            パスワードを設定
          </button>
        </div>
        {pwMessage && <p className="mt-2 text-sm text-gray-700">{pwMessage}</p>}
      </section>

      <section className="mb-6 rounded-lg border p-4">
        <h2 className="mb-2 font-semibold">
          2段階認証(2FA){" "}
          {totpEnabled === true && <span className="text-sm text-green-600">有効</span>}
          {totpEnabled === false && <span className="text-sm text-gray-400">未設定</span>}
        </h2>
        <p className="mb-3 text-sm text-gray-500">
          Google Authenticator などの認証アプリを使い、ログイン時にワンタイムコードを要求します。
          責任者は有効化を推奨します(パスワード設定後に利用できます)。
        </p>

        {totpEnabled === false && !totpSetup && (
          <button onClick={startTotpSetup} className="rounded bg-black px-3 py-2 text-sm text-white">
            2段階認証を設定する
          </button>
        )}

        {totpSetup && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-600">
              認証アプリでQRコードを読み取るか、キーを手入力してください。
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={totpSetup.qr} alt="2FA QRコード" width={160} height={160} />
            <code className="text-xs break-all text-gray-500">{totpSetup.secret}</code>
            <div className="flex items-center gap-2">
              <input
                className="w-32 rounded border px-3 py-2 text-sm"
                placeholder="6桁コード"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
              />
              <button onClick={enableTotp} className="rounded bg-black px-3 py-2 text-sm text-white">
                有効にする
              </button>
            </div>
          </div>
        )}

        {recoveryCodes && (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3">
            <p className="mb-1 text-sm font-semibold text-amber-900">
              リカバリーコード(この画面を閉じると再表示できません)
            </p>
            <p className="mb-2 text-xs text-amber-800">
              スマホを紛失したときは、ログイン画面のコード欄にこのいずれかを入力します。各コードは1回のみ有効です。安全な場所に保管してください。
            </p>
            <div className="grid grid-cols-2 gap-1 font-mono text-sm sm:grid-cols-4">
              {recoveryCodes.map((rc) => (
                <span key={rc} className="rounded bg-white px-2 py-1 text-center">
                  {rc}
                </span>
              ))}
            </div>
          </div>
        )}

        {totpEnabled === true && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm text-gray-500">
              未使用のリカバリーコード: 残り {recoveryRemaining} 個
              <button onClick={regenerateRecoveryCodes} className="ml-2 text-blue-600 hover:underline">
                再発行する
              </button>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="password"
                className="rounded border px-3 py-2 text-sm"
                placeholder="パスワード(確認用)"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
              />
              <button
                onClick={disableTotp}
                className="rounded border px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                2段階認証を無効にする
              </button>
            </div>
          </div>
        )}
        {totpMessage && <p className="mt-2 text-sm text-gray-700">{totpMessage}</p>}
      </section>

      <section className="mb-6 rounded-lg border p-4">
        <h2 className="mb-2 font-semibold">APIキーの再発行</h2>
        <p className="mb-2 text-sm text-gray-500">
          APIキーが漏れた恐れがあるときは、再発行すると古いキーは使えなくなります。
        </p>
        <button onClick={rotateKey} className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
          APIキーを再発行する
        </button>
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
