"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import type { PaymentRecord } from "@/db/schema";
import { formatDateTime, formatIDR, getMethodLabel } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

export function CheckoutReturnClient() {
  const searchParams = useSearchParams();
  const referenceId =
    searchParams.get("reference_id") || searchParams.get("order") || "";

  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(referenceId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!referenceId) return;
    let active = true;
    fetch(`/api/payments/${encodeURIComponent(referenceId)}?refresh=true`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Gagal memverifikasi status.");
        if (active) setPayment(data.payment);
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error ? err.message : "Gagal memverifikasi transaksi."
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [referenceId]);

  if (!referenceId) {
    return (
      <div className="max-w-xl mx-auto rounded-2xl border border-[#E4E8EE] bg-white p-8 text-center space-y-4">
        <h1 className="text-lg font-bold text-[#0F172A]">
          Parameter Transaksi Kosong
        </h1>
        <p className="text-sm text-[#526071]">
          Halaman ini adalah tujuan <code>return_url</code> setelah selesai dari
          Hosted Checkout BorderPay.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D4ED8] text-white text-sm font-semibold hover:bg-[#1E40AF]"
        >
          <span>Kembali ke Checkout Demo</span>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto rounded-2xl border border-[#E4E8EE] bg-white p-10 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#1D4ED8] mx-auto" />
        <h1 className="text-base font-bold text-[#0F172A]">
          Memverifikasi Status Pembayaran...
        </h1>
        <p className="text-xs text-[#526071]">
          Memeriksa status terkini pesanan{" "}
          <code className="font-mono-num">{referenceId}</code>...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto rounded-2xl border border-[#E4E8EE] bg-white p-8 shadow-2xs space-y-6">
      {error || !payment ? (
        <div className="text-center space-y-3">
          <XCircle className="h-10 w-10 text-red-500 mx-auto" />
          <h1 className="text-lg font-bold text-[#0F172A]">
            Verifikasi Gagal
          </h1>
          <p className="text-sm text-[#526071]">{error}</p>
        </div>
      ) : (
        <>
          <div className="text-center space-y-2.5">
            {payment.status === "paid" ? (
              <div className="h-14 w-14 rounded-full bg-teal-600 text-white flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8" />
              </div>
            ) : payment.status === "pending" ? (
              <div className="h-14 w-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <Clock className="h-8 w-8" />
              </div>
            ) : (
              <div className="h-14 w-14 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
                <XCircle className="h-8 w-8" />
              </div>
            )}

            <h1 className="text-xl font-bold text-[#0F172A]">
              {payment.status === "paid"
                ? "Terima Kasih, Pembayaran Lunas!"
                : payment.status === "pending"
                  ? "Pembayaran Masih Menunggu"
                  : "Pembayaran Tidak Selesai"}
            </h1>
            <div className="flex justify-center">
              <StatusBadge status={payment.status} />
            </div>
          </div>

          <div className="rounded-xl bg-[#F7F8FA] border border-[#E4E8EE] p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#526071]">Reference ID</span>
              <span className="font-mono-num font-bold text-[#0F172A]">
                {payment.referenceId}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#526071]">Item</span>
              <span className="font-medium text-[#0F172A]">{payment.itemName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#526071]">Metode</span>
              <span className="font-medium text-[#0F172A]">
                {getMethodLabel(payment.method, payment.bankCode)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#526071]">Total Dibayar</span>
              <span className="font-mono-num font-bold text-[#0F172A]">
                {formatIDR(payment.customerPays)}
              </span>
            </div>
            {payment.paidAt && (
              <div className="flex justify-between">
                <span className="text-[#526071]">Waktu Lunas</span>
                <span className="text-[#0F172A]">
                  {formatDateTime(payment.paidAt)}
                </span>
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        {referenceId && (
          <Link
            href={`/pay/${encodeURIComponent(referenceId)}`}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1D4ED8] text-white text-sm font-semibold hover:bg-[#1E40AF]"
          >
            <span>Lihat Detail / Struk</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
        <Link
          href="/transactions"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#E4E8EE] bg-white text-sm font-semibold text-[#0F172A] hover:bg-slate-50"
        >
          <span>Dashboard Transaksi</span>
        </Link>
      </div>
    </div>
  );
}
