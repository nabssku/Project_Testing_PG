"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Loader2,
  Printer,
  QrCode,
  RefreshCw,
  ShoppingBag,
  Wallet,
  XCircle,
} from "lucide-react";
import type { PaymentRecord } from "@/db/schema";
import {
  cn,
  formatDateTime,
  formatIDR,
  getMethodLabel,
} from "@/lib/format";
import { CopyButton } from "./CopyButton";
import { StatusBadge } from "./StatusBadge";

function formatRemaining(
  expiresAt: string | Date | null | undefined,
  nowMs: number
): string | null {
  if (!expiresAt) return null;
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) return null;
  const diff = Math.max(0, Math.floor((target - nowMs) / 1000));
  if (diff <= 0) return "Waktu habis";
  const hrs = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  const secs = diff % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function PaymentInstructions({
  referenceId,
  initialRefresh = false,
}: {
  referenceId: string;
  initialRefresh?: boolean;
}) {
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<
    "refresh" | "simulate" | "cancel" | null
  >(null);
  const [actionNotice, setActionNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [qrState, setQrState] = useState<{
    qrString: string;
    dataUrl: string;
  } | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const fetchPayment = useCallback(
    async (refresh = false, silent = false) => {
      if (!silent) {
        setActionLoading(refresh ? "refresh" : null);
      }
      try {
        const res = await fetch(
          `/api/payments/${encodeURIComponent(referenceId)}${refresh ? "?refresh=true" : ""}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Gagal memuat detail pembayaran.");
        }
        setPayment(data.payment);
        setError(null);
        if (refresh && !silent) {
          setActionNotice({
            type: "success",
            text:
              data.payment.status === "paid"
                ? "Pembayaran telah diterima dan dikonfirmasi lunas."
                : `Status pesanan saat ini: ${data.payment.status === "pending" ? "Menunggu Pembayaran" : data.payment.status}.`,
          });
        }
      } catch (err) {
        if (!silent) {
          setError(
            err instanceof Error
              ? err.message
              : "Pesanan tidak dapat dimuat."
          );
        }
      } finally {
        setLoading(false);
        setActionLoading(null);
      }
    },
    [referenceId]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/payments/${encodeURIComponent(referenceId)}${initialRefresh ? "?refresh=true" : ""}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          throw new Error(data.message || "Gagal memuat detail pembayaran.");
        }
        setPayment(data.payment);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Pesanan tidak dapat dimuat."
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [referenceId, initialRefresh]);

  useEffect(() => {
    const rawQr = payment?.qrString;
    if (!rawQr) return;
    let mounted = true;
    QRCode.toDataURL(rawQr, {
      width: 280,
      margin: 2,
      color: { dark: "#0F172A", light: "#FFFFFF" },
    })
      .then((url) => {
        if (mounted) setQrState({ qrString: rawQr, dataUrl: url });
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [payment?.qrString]);

  const qrDataUrl =
    payment?.qrString && qrState?.qrString === payment.qrString
      ? qrState.dataUrl
      : null;

  useEffect(() => {
    if (payment?.status !== "pending") return;
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    const poll = setInterval(() => {
      fetchPayment(true, true);
    }, 5000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [payment?.status, fetchPayment]);

  async function handleSimulate() {
    setActionLoading("simulate");
    setActionNotice(null);
    try {
      const res = await fetch(
        `/api/payments/${encodeURIComponent(referenceId)}/simulate`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Simulasi pembayaran gagal.");
      }
      if (data.payment) setPayment(data.payment);
      setActionNotice({
        type: "success",
        text: "Pembayaran berhasil disimulasikan dan pesanan telah lunas.",
      });
    } catch (err) {
      setActionNotice({
        type: "error",
        text:
          err instanceof Error ? err.message : "Gagal menyimulasikan bayar.",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel() {
    setActionLoading("cancel");
    setActionNotice(null);
    try {
      const res = await fetch(
        `/api/payments/${encodeURIComponent(referenceId)}/cancel`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Gagal membatalkan pesanan.");
      }
      if (data.payment) setPayment(data.payment);
      setActionNotice({
        type: "success",
        text: "Pesanan berhasil dibatalkan.",
      });
    } catch (err) {
      setActionNotice({
        type: "error",
        text:
          err instanceof Error ? err.message : "Gagal membatalkan pesanan.",
      });
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-16 flex flex-col items-center justify-center gap-3 text-sm text-[#526071]">
        <Loader2 className="h-6 w-6 animate-spin text-[#1D4ED8]" />
        <span>Memuat halaman pembayaran...</span>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="max-w-xl mx-auto rounded-2xl border border-[#E4E8EE] bg-white p-8 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
        <h1 className="text-lg font-bold text-[#0F172A]">
          Pesanan Tidak Ditemukan
        </h1>
        <p className="text-sm text-[#526071]">
          {error || `Nomor pesanan ${referenceId} tidak ditemukan.`}
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1D4ED8] text-white text-sm font-semibold hover:bg-[#1E40AF]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali Belanja</span>
        </Link>
      </div>
    );
  }

  const remaining = formatRemaining(payment.expiresAt, nowMs);
  const isPaid = payment.status === "paid";
  const isPending = payment.status === "pending";

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#526071] hover:text-[#0F172A] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Toko</span>
        </Link>
        <Link
          href="/transactions"
          className="text-sm font-medium text-[#1D4ED8] hover:underline"
        >
          Lihat Daftar Pesanan →
        </Link>
      </div>

      {actionNotice && (
        <div
          className={cn(
            "no-print rounded-xl border px-4 py-3 text-sm flex items-start gap-2.5",
            actionNotice.type === "success"
              ? "border-teal-200 bg-teal-50 text-teal-900"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          {actionNotice.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-teal-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
          )}
          <span>{actionNotice.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Panel Kiri: Instruksi Pembayaran / Struk Lunas */}
        <div className="lg:col-span-7 rounded-2xl border border-[#E4E8EE] bg-white overflow-hidden shadow-2xs">
          <div className="px-6 py-4 border-b border-[#E4E8EE] flex flex-wrap items-center justify-between gap-3 bg-[#F7F8FA]/60">
            <div>
              <div className="text-[11px] font-medium text-[#526071]">
                Nomor Pesanan
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono-num text-sm font-bold text-[#0F172A]">
                  {payment.referenceId}
                </span>
                <CopyButton
                  value={payment.referenceId}
                  label="Salin"
                  className="no-print"
                />
              </div>
            </div>
            <StatusBadge status={payment.status} className="text-xs px-3 py-1" />
          </div>

          <div className="p-6">
            {isPaid ? (
              <div className="space-y-6">
                <div className="rounded-xl bg-teal-50/70 border border-teal-200/80 p-6 text-center space-y-2">
                  <div className="h-12 w-12 rounded-full bg-teal-600 text-white flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h1 className="text-xl font-bold text-teal-950">
                    Pembayaran Berhasil!
                  </h1>
                  <p className="text-xs text-teal-800">
                    Lunas pada {formatDateTime(payment.paidAt || payment.updatedAt)}
                  </p>
                  <div className="font-mono-num text-3xl font-extrabold text-[#0F172A] pt-1">
                    {formatIDR(payment.customerPays)}
                  </div>
                </div>

                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100">
                    <span className="text-[#526071] shrink-0">Produk</span>
                    <span className="font-semibold text-[#0F172A] text-right">
                      {payment.itemName}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100">
                    <span className="text-[#526071]">Pembeli</span>
                    <span className="font-medium text-[#0F172A]">
                      {payment.customerName}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100">
                    <span className="text-[#526071]">Metode Pembayaran</span>
                    <span className="font-semibold text-[#0F172A]">
                      {getMethodLabel(payment.method, payment.bankCode)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 py-1.5">
                    <span className="font-semibold text-[#0F172A]">
                      Total Dibayar
                    </span>
                    <span className="font-mono-num font-bold text-teal-700">
                      {formatIDR(payment.customerPays)}
                    </span>
                  </div>
                </div>

                <div className="no-print flex flex-wrap gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E4E8EE] bg-white text-sm font-semibold text-[#0F172A] hover:bg-slate-50 cursor-pointer"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Cetak Struk</span>
                  </button>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D4ED8] text-white text-sm font-semibold hover:bg-[#1E40AF]"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span>Belanja Lagi</span>
                  </Link>
                </div>
              </div>
            ) : isPending ? (
              <div className="space-y-6">
                {/* Total & Countdown */}
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#F7F8FA] border border-[#E4E8EE] p-4">
                  <div>
                    <div className="text-xs font-medium text-[#526071]">
                      Total Pembayaran
                    </div>
                    <div className="font-mono-num text-2xl sm:text-3xl font-extrabold text-[#0F172A] mt-0.5">
                      {formatIDR(payment.customerPays)}
                    </div>
                  </div>
                  {remaining && (
                    <div className="text-right">
                      <div className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Selesaikan dalam</span>
                      </div>
                      <div className="font-mono-num text-lg font-bold text-amber-800 mt-0.5">
                        {remaining}
                      </div>
                    </div>
                  )}
                </div>

                {/* Instruksi QRIS */}
                {payment.method === "qris" && (
                  <div className="flex flex-col items-center text-center space-y-4 py-1">
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F172A] bg-slate-100 px-3 py-1 rounded-full">
                      <QrCode className="h-3.5 w-3.5 text-[#1D4ED8]" />
                      <span>Pindai QRIS dengan m-Banking atau E-Wallet</span>
                    </div>

                    {qrDataUrl ? (
                      <div className="p-4 rounded-2xl border-2 border-[#E4E8EE] bg-white shadow-xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={qrDataUrl}
                          alt={`QRIS untuk ${payment.referenceId}`}
                          className="w-56 h-56 object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-56 h-56 rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-4 text-xs text-[#526071]">
                        <QrCode className="h-8 w-8 mb-2 text-slate-400" />
                        <span>Menyiapkan kode QRIS...</span>
                      </div>
                    )}

                    {qrDataUrl && (
                      <a
                        href={qrDataUrl}
                        download={`qris-${payment.referenceId}.png`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#E4E8EE] bg-white text-xs font-semibold text-[#0F172A] hover:bg-slate-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Simpan Gambar QRIS</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Instruksi Virtual Account */}
                {payment.method === "va" && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1D4ED8]">
                        <Building2 className="h-4 w-4" />
                        <span>
                          Virtual Account{" "}
                          {payment.vaBank || payment.bankCode || "Bank"}
                        </span>
                      </div>
                      {payment.vaNumber && (
                        <CopyButton
                          value={payment.vaNumber}
                          label="Salin Nomor"
                        />
                      )}
                    </div>
                    <div className="font-mono-num text-2xl sm:text-3xl font-extrabold tracking-wider text-[#0F172A] break-all">
                      {payment.vaNumber || "—"}
                    </div>
                    <p className="text-xs text-[#526071] leading-relaxed">
                      Transfer tepat sebesar{" "}
                      <strong className="font-mono-num text-[#0F172A]">
                        {formatIDR(payment.customerPays)}
                      </strong>{" "}
                      melalui m-Banking, Internet Banking, atau ATM ke nomor
                      Virtual Account di atas.
                    </p>
                  </div>
                )}

                {/* Instruksi E-Wallet */}
                {payment.method === "ewallet" && (
                  <div className="rounded-xl border border-[#E4E8EE] bg-[#F7F8FA] p-5 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#0F172A]">
                      <Wallet className="h-5 w-5 text-[#1D4ED8]" />
                      <span>
                        Bayar via {payment.bankCode || "E-Wallet"}
                      </span>
                    </div>
                    <p className="text-xs text-[#526071]">
                      Lanjutkan ke aplikasi e-wallet Anda untuk menyelesaikan
                      pembayaran sebesar{" "}
                      <strong className="font-mono-num text-[#0F172A]">
                        {formatIDR(payment.customerPays)}
                      </strong>
                      .
                    </p>
                    {(payment.checkoutUrl || payment.payUrl) && (
                      <a
                        href={payment.checkoutUrl || payment.payUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D4ED8] text-white text-sm font-semibold hover:bg-[#1E40AF]"
                      >
                        <span>Buka Aplikasi E-Wallet</span>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                )}

                {payment.payUrl && (
                  <div className="pt-2 border-t border-[#E4E8EE] flex justify-center">
                    <a
                      href={payment.payUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#526071] hover:text-[#1D4ED8] transition-colors"
                    >
                      <span>Atau buka halaman pembayaran BorderPay</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <XCircle className="h-12 w-12 text-slate-400 mx-auto" />
                <h2 className="text-lg font-bold text-[#0F172A]">
                  Pesanan{" "}
                  {payment.status === "expired" ? "Kedaluwarsa" : "Dibatalkan"}
                </h2>
                <p className="text-sm text-[#526071] max-w-md mx-auto">
                  Batas waktu pembayaran telah berakhir atau pesanan telah
                  dibatalkan.
                </p>
                <div className="pt-2">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D4ED8] text-white text-sm font-semibold hover:bg-[#1E40AF]"
                  >
                    <span>Belanja Lagi</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel Kanan: Ringkasan Pesanan & Simulasi Demo */}
        <div className="no-print lg:col-span-5 space-y-5">
          {/* Rincian Pesanan */}
          <div className="rounded-2xl border border-[#E4E8EE] bg-white p-5 shadow-2xs space-y-3 text-xs">
            <div className="font-bold text-sm text-[#0F172A]">
              Rincian Pesanan
            </div>
            <div className="space-y-2.5">
              <div className="flex justify-between gap-3">
                <span className="text-[#526071] shrink-0">Produk</span>
                <span className="font-semibold text-[#0F172A] text-right">
                  {payment.itemName}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#526071]">Pembeli</span>
                <span className="font-medium text-[#0F172A]">
                  {payment.customerName}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#526071]">Metode</span>
                <span className="font-semibold text-[#0F172A]">
                  {getMethodLabel(payment.method, payment.bankCode)}
                </span>
              </div>
              <div className="flex justify-between gap-3 border-t border-slate-100 pt-2.5">
                <span className="text-[#526071]">Subtotal</span>
                <span className="font-mono-num text-[#0F172A]">
                  {formatIDR(payment.orderAmount)}
                </span>
              </div>
              {payment.customerPays > payment.orderAmount && (
                <div className="flex justify-between gap-3">
                  <span className="text-[#526071]">Biaya Layanan</span>
                  <span className="font-mono-num text-[#0F172A]">
                    {formatIDR(payment.customerPays - payment.orderAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-3 font-semibold text-sm border-t border-slate-100 pt-2.5">
                <span className="text-[#0F172A]">Total</span>
                <span className="font-mono-num text-[#0F172A]">
                  {formatIDR(payment.customerPays)}
                </span>
              </div>
            </div>
          </div>

          {/* Panel Simulasi Demo */}
          <div className="rounded-2xl border border-[#E4E8EE] bg-white p-5 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#0F172A]">
                Aksi Pembayaran
              </span>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                Mode Demo
              </span>
            </div>

            <div className="space-y-2.5">
              {isPending && payment.mode === "test" && (
                <button
                  type="button"
                  onClick={handleSimulate}
                  disabled={actionLoading !== null}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm px-4 py-3 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === "simulate" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span>Simulasikan Bayar Lunas</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => fetchPayment(true, false)}
                disabled={actionLoading !== null}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#E4E8EE] bg-white hover:bg-slate-50 text-[#0F172A] font-semibold text-sm px-4 py-2.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={cn(
                    "h-4 w-4 text-[#1D4ED8]",
                    actionLoading === "refresh" && "animate-spin"
                  )}
                />
                <span>Cek Status Pembayaran</span>
              </button>

              {isPending && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={actionLoading !== null}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/40 hover:bg-red-50 text-red-700 font-semibold text-sm px-4 py-2.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === "cancel" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <span>Batalkan Pesanan</span>
                </button>
              )}
            </div>

            {isPending && (
              <p className="text-[11px] text-[#526071] text-center">
                Status pembayaran diperiksa otomatis setiap 5 detik.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
