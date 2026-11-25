"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  Wallet,
} from "lucide-react";
import type { DisbursementRecord } from "@/db/schema";
import { DISBURSEMENT_BANKS } from "@/lib/catalog";
import { cn, formatDateTime, formatIDR } from "@/lib/format";
import { JsonInspector } from "./JsonInspector";
import { StatusBadge } from "./StatusBadge";

export function DisbursementsClient() {
  const [rows, setRows] = useState<DisbursementRecord[]>([]);
  const [remoteError, setRemoteError] = useState<{
    code: string;
    message: string;
    status: number;
  } | null>(null);
  const [balance, setBalance] = useState<{
    available: number;
    pending: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Form
  const [bankCode, setBankCode] = useState("BCA");
  const [accountNumber, setAccountNumber] = useState("1234567890");
  const [accountName, setAccountName] = useState("Budi Santoso");
  const [amount, setAmount] = useState("100000");
  const [referenceId, setReferenceId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    ok: boolean;
    message: string;
    raw?: unknown;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [disbRes, balRes] = await Promise.all([
        fetch("/api/disbursements", { cache: "no-store" }),
        fetch("/api/balance", { cache: "no-store" }),
      ]);
      const disbData = await disbRes.json();
      const balData = await balRes.json();

      if (disbRes.ok) {
        setRows(disbData.disbursements || []);
        setRemoteError(disbData.remoteError || null);
      }
      if (balRes.ok && balData.balance) {
        setBalance(balData.balance);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [disbRes, balRes] = await Promise.all([
          fetch("/api/disbursements", { cache: "no-store" }),
          fetch("/api/balance", { cache: "no-store" }),
        ]);
        const disbData = await disbRes.json();
        const balData = await balRes.json();
        if (!active) return;

        if (disbRes.ok) {
          setRows(disbData.disbursements || []);
          setRemoteError(disbData.remoteError || null);
        }
        if (balRes.ok && balData.balance) {
          setBalance(balData.balance);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitResult(null);

    try {
      const res = await fetch("/api/disbursements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number.parseInt(amount.replace(/\D/g, ""), 10) || 0,
          bankCode,
          accountNumber: accountNumber.replace(/\D/g, ""),
          accountName: accountName.trim(),
          referenceId: referenceId.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitResult({
          ok: false,
          message: data.message || "Permintaan disbursement ditolak BorderPay.",
          raw: data.details || data,
        });
        return;
      }

      setSubmitResult({
        ok: true,
        message: `Disbursement ${data.disbursement?.referenceId} berhasil dikirim dengan status ${data.disbursement?.status}.`,
        raw: data.borderpayResponse,
      });
      setReferenceId("");
      await loadData();
    } catch (err) {
      setSubmitResult({
        ok: false,
        message:
          err instanceof Error ? err.message : "Gagal menghubungi server.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
            Payout & Disbursements Playground
          </h1>
          <p className="text-sm text-[#526071] mt-1">
            Uji pengiriman dana keluar ke rekening bank via{" "}
            <code className="font-mono-num text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              POST /api/v1/disbursements
            </code>{" "}
            beserta pemantauan riwayat{" "}
            <code className="font-mono-num text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              GET /api/v1/disbursements
            </code>
            .
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#E4E8EE] bg-white text-sm font-semibold text-[#0F172A] hover:bg-slate-50 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4 text-[#1D4ED8]", loading && "animate-spin")} />
          <span>Muat Ulang</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Payout */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 rounded-2xl border border-[#E4E8EE] bg-white p-5 sm:p-6 shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between border-b border-[#E4E8EE] pb-3.5">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">
                Kirim Payout Baru
              </h2>
              <p className="text-xs text-[#526071]">
                Minimal Rp 10.000 · Idempoten via reference_id
              </p>
            </div>
            {balance && (
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-[#526071] flex items-center justify-end gap-1">
                  <Wallet className="h-3 w-3 text-[#1D4ED8]" />
                  <span>Saldo Tersedia</span>
                </div>
                <div className="font-mono-num text-sm font-bold text-[#0F172A]">
                  {formatIDR(balance.available)}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Bank Tujuan (bank_code)
              </label>
              <select
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                className="w-full rounded-lg border border-[#E4E8EE] bg-white px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:border-[#1D4ED8]"
              >
                {DISBURSEMENT_BANKS.map((bank) => (
                  <option key={bank.code} value={bank.code}>
                    {bank.code} — {bank.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Nomor Rekening (6–20 digit)
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={accountNumber}
                onChange={(e) =>
                  setAccountNumber(e.target.value.replace(/\D/g, ""))
                }
                placeholder="1234567890"
                className="w-full rounded-lg border border-[#E4E8EE] px-3 py-2 text-sm font-mono-num text-[#0F172A] focus:outline-none focus:border-[#1D4ED8]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Nama Pemilik Rekening
              </label>
              <input
                type="text"
                required
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Budi Santoso"
                className="w-full rounded-lg border border-[#E4E8EE] px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:border-[#1D4ED8]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Nominal (IDR)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-lg border border-[#E4E8EE] px-3 py-2 text-sm font-mono-num font-semibold text-[#0F172A] focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Reference ID (Opsional)
                </label>
                <input
                  type="text"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  placeholder="Otomatis: PO-..."
                  className="w-full rounded-lg border border-[#E4E8EE] px-3 py-2 text-sm font-mono-num text-[#0F172A] focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-semibold text-sm px-4 py-3 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span>Kirim Permintaan Disbursement</span>
          </button>

          {submitResult && (
            <div className="space-y-3 pt-1">
              <div
                className={cn(
                  "rounded-xl border p-3.5 text-xs flex items-start gap-2.5",
                  submitResult.ok
                    ? "border-teal-200 bg-teal-50 text-teal-900"
                    : "border-red-200 bg-red-50 text-red-800"
                )}
              >
                {submitResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-teal-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                )}
                <span>{submitResult.message}</span>
              </div>
              {submitResult.raw !== undefined && (
                <JsonInspector
                  title="Respons API Disbursement"
                  badge={submitResult.ok ? "201" : "ERROR"}
                  data={submitResult.raw}
                  maxHeightClass="max-h-52"
                />
              )}
            </div>
          )}
        </form>

        {/* Riwayat Disbursements */}
        <div className="lg:col-span-7 space-y-4">
          {remoteError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <div className="font-semibold">
                  Info Sinkronisasi GET /api/v1/disbursements ({remoteError.code})
                </div>
                <p className="mt-0.5">{remoteError.message}</p>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-[#E4E8EE] bg-white shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E4E8EE] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#0F172A]">
                  Riwayat Disbursements (Neon DB)
                </h2>
                <p className="text-xs text-[#526071]">
                  Pencatatan payout dengan nomor rekening ter-mask otomatis.
                </p>
              </div>
              <span className="font-mono-num text-xs text-[#526071]">
                {rows.length} record
              </span>
            </div>

            {loading ? (
              <div className="py-14 flex items-center justify-center gap-2 text-sm text-[#526071]">
                <Loader2 className="h-5 w-5 animate-spin text-[#1D4ED8]" />
                <span>Memuat riwayat payout...</span>
              </div>
            ) : rows.length === 0 ? (
              <div className="py-14 px-6 text-center text-xs text-[#526071] space-y-1.5">
                <div className="font-semibold text-[#0F172A] text-sm">
                  Belum ada riwayat disbursement
                </div>
                <p>
                  Kirim permintaan payout dari formulir di samping untuk menguji
                  endpoint <code>POST /api/v1/disbursements</code>.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E4E8EE] bg-[#F7F8FA]/80 text-[11px] font-semibold uppercase tracking-wider text-[#526071]">
                      <th className="py-3 px-4">Reference ID</th>
                      <th className="py-3 px-4">Tujuan</th>
                      <th className="py-3 px-4 text-right">Nominal / Potongan</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E8EE] text-xs">
                    {rows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-mono-num font-bold text-[#0F172A]">
                          {row.referenceId}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#0F172A]">
                            {row.bankCode} ·{" "}
                            <span className="font-mono-num">
                              {row.accountNumberMasked}
                            </span>
                          </div>
                          <div className="text-[#526071]">{row.accountName}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono-num">
                          <div className="font-bold text-[#0F172A]">
                            {formatIDR(row.amount)}
                          </div>
                          <div className="text-[11px] text-[#526071]">
                            Total: {formatIDR(row.totalDeducted)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={row.status} />
                          {row.failReason && (
                            <div className="text-[11px] text-red-600 mt-1">
                              {row.failReason}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#526071] whitespace-nowrap">
                          {formatDateTime(row.processedAt || row.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
