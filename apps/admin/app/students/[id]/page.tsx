"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { apiFetch } from "@/lib/api";
import type { StudentStatus } from "@school-harness/shared";

interface StudentDetail {
  id: string;
  name: string;
  grade: string | null;
  course: string | null;
  status: StudentStatus;
  tags: string[];
  qr_token: string | null;
  monthly_fee: number | null;
  guardians: {
    id: string;
    name: string | null;
    line_user_id: string | null;
    relation: string | null;
  }[];
}

interface InviteCodeResult {
  code: string;
  expires_at: string;
}

const STATUSES: StudentStatus[] = ["在籍", "休会", "退会"];

function StudentDetailView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteCodeResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [monthlyFeeInput, setMonthlyFeeInput] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<StudentDetail>(`/api/students/${params.id}`);
      setStudent(res);
      setMonthlyFeeInput(res.monthly_fee != null ? String(res.monthly_fee) : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!student?.qr_token) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(student.qr_token, { width: 200 }).then(setQrDataUrl);
  }, [student?.qr_token]);

  async function updateStatus(status: StudentStatus) {
    if (!student) return;
    await apiFetch(`/api/students/${student.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setStudent({ ...student, status });
  }

  async function handleDelete() {
    if (!student) return;
    if (!confirm(`${student.name} を削除しますか?関連する出欠・報告書等もすべて削除されます。`)) return;
    await apiFetch(`/api/students/${student.id}`, { method: "DELETE" });
    router.push("/students");
  }

  async function issueInvite() {
    if (!student) return;
    const res = await apiFetch<InviteCodeResult>(`/api/students/${student.id}/invite-codes`, {
      method: "POST",
    });
    setInvite(res);
  }

  async function saveMonthlyFee() {
    if (!student) return;
    const monthly_fee = monthlyFeeInput === "" ? null : Number(monthlyFeeInput);
    const res = await apiFetch<StudentDetail>(`/api/students/${student.id}`, {
      method: "PATCH",
      body: JSON.stringify({ monthly_fee }),
    });
    setStudent({ ...student, monthly_fee: res.monthly_fee });
  }

  async function regenerateQr() {
    if (!student) return;
    if (
      student.qr_token &&
      !confirm("QRコードを再発行すると、これまで印刷したQRカードは使えなくなります。よろしいですか?")
    )
      return;
    const res = await apiFetch<{ qr_token: string }>(`/api/students/${student.id}/qr-token`, {
      method: "POST",
    });
    setStudent({ ...student, qr_token: res.qr_token });
  }

  if (error) return <main className="p-6 text-red-600">{error}</main>;
  if (!student) return <main className="p-6 text-gray-500">読み込み中...</main>;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-bold">{student.name}</h1>
      <p className="mb-4 text-sm text-gray-500">
        {student.grade ?? "-"} / {student.course ?? "-"}
      </p>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">ステータス</h2>
        <div className="flex gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => updateStatus(s)}
              className={`rounded px-3 py-1.5 text-sm ${
                student.status === s ? "bg-black text-white" : "bg-gray-100"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">保護者</h2>
        {student.guardians.length === 0 ? (
          <p className="text-sm text-gray-500">まだ保護者が紐付けられていません。</p>
        ) : (
          <ul className="mb-3 text-sm">
            {student.guardians.map((g) => (
              <li key={g.id}>
                {g.name ?? "(LINE連携済・未設定)"} {g.relation ? `(${g.relation})` : ""}
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={issueInvite}
          className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          招待コードを発行する
        </button>
        {invite && (
          <div className="mt-3 rounded bg-gray-100 p-3 text-sm">
            <p>
              招待コード: <code className="font-bold">{invite.code}</code>
            </p>
            <p className="text-gray-500">
              有効期限: {new Date(invite.expires_at).toLocaleString("ja-JP")}
            </p>
            <p className="mt-1 text-gray-500">
              保護者にLINE公式アカウントを友だち追加してもらい、LIFFの紐付け画面でこのコードを入力してもらってください。
            </p>
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">月謝</h2>
        <div className="flex items-center gap-2">
          <span>¥</span>
          <input
            type="number"
            className="w-32 rounded border px-3 py-2 text-sm"
            value={monthlyFeeInput}
            onChange={(e) => setMonthlyFeeInput(e.target.value)}
            placeholder="未設定"
          />
          <button
            onClick={saveMonthlyFee}
            className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            保存
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          請求書作成時にこの金額が「月謝」項目として自動入力されます(兄弟割引等はその都度手動調整)。
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">入退室QRコード</h2>
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="入退室QRコード" width={160} height={160} />
        ) : (
          <p className="text-sm text-gray-500">QRコードがまだ発行されていません。</p>
        )}
        <button
          onClick={regenerateQr}
          className="mt-2 rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          {student.qr_token ? "QRコードを再発行する" : "QRコードを発行する"}
        </button>
        <p className="mt-1 text-sm text-gray-500">
          印刷してカードにし、教室のQRリーダー画面(<code>/kiosk</code>)で読み取ってもらってください。
        </p>
      </section>

      <button onClick={handleDelete} className="text-sm text-red-600 hover:underline">
        この生徒を削除する
      </button>
    </main>
  );
}

export default function StudentDetailPage() {
  return (
    <AuthGuard>
      <NavBar />
      <StudentDetailView />
    </AuthGuard>
  );
}
