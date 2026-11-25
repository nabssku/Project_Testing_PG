"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Wallet,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import type { PaymentRecord } from "@/db/schema";
import {
  cn,
  formatDateTime,
  formatIDR,
  getMethodLabel,
} from "@/lib/format";
import { JsonInspector } from "./JsonInspector";
import { StatusBadge } from "./StatusBadge";

interface PaymentSummary {
  totalCount: number;
  paidCount: number;
  pendingCount: number;
  expiredCount: number;
  failedCount: number;
  paidVolume: number;
  pendingVolume: number;
  netMerchantReceives: number;
  totalFees: number;
}

interface BalanceInfo {
  available: number;
  pending: number;
  currency: string;
}

const STATUS_TABS = [
  { id: "", label: "Semua" },
  { id: "pending", label: "Menunggu" },
  { id: "paid", label: "Lunas" },
  { id: "expired", label: "Kedaluwarsa" },
  { id: "failed", label: "Gagal" },
];

export function TransactionsClient() {
  const [rows, setRows] = useState<PaymentRecord[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [inspectPayment, setInspectPayment] = useState<PaymentRecord | null>(
    null
  );

  const loadData = useCallback(
    async (options?: { sync?: boolean }) => {
      if (options?.sync) setSyncing(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams();
        if (statusFilter) params.set("status", statusFilter);
        if (searchQuery.trim()) params.set("q", searchQuery.trim());
        if (options?.sync) params.set("sync", "true");

        const [payRes, balRes] = await Promise.all([
          fetch(`/api/payments?${params.toString()}`, { cache: "no-store" }),
          fetch("/api/balance", { cache: "no-store" }),
        ]);

        const payData = await payRes.json();
        const balData = await balRes.json();

        if (!payRes.ok) {
          throw new Error(payData.message || "Gagal memuat transaksi.");
        }

        setRows(payData.payments || []);
        setSummary(payData.summary || null);
        setBalance(balData.balance || null);
        setBalanceError(balData.balanceError || null);

        if (options?.sync && payData.sync) {
          if (payData.sync.error) {
            setNotice({ type: "error", text: payData.sync.error });
          } else {
            setNotice({
              type: "success",
              text: `Sinkronisasi selesai: memeriksa ${payData.sync.remoteTotal} transaksi BorderPay, ${payData.sync.updatedCount} status diperbarui di Neon DB.`,
            });
          }
        }
      } catch (err) {
        setNotice({
          type: "error",
          text:
            err instanceof Error
              ? err.message
              : "Gagal mengambil data transaksi.",
        });
      } finally {
        setLoading(false);
        setSyncing(false);
      }
    },
    [statusFilter, searchQuery]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 180);
    return () => clearTimeout(timer);
  }, [loadData]);

  async function runRowAction(
    referenceId: string,
    action: "simulate" | "refresh" | "cancel"
  ) {
    setBusyRef(`${referenceId}:${action}`);
    setNotice(null);
    try {
      let res: Response;
      if (action === "refresh") {
        res = await fetch(
          `/api/payments/${encodeURIComponent(referenceId)}?refresh=true`,
          { cache: "no-store" }
        );
      } else {
        res = await fetch(
          `/api/payments/${encodeURIComponent(referenceId)}/${action}`,
          { method: "POST" }
        );
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Aksi ${action} gagal.`);
      }
      setNotice({
        type: "success",
        text:
          action === "simulate"
            ? `Transaksi ${referenceId} berhasil disimulasikan lunas (paid).`
            : action === "cancel"
              ? `Transaksi ${referenceId} berhasil dibatalkan (expired).`
              : `Status ${referenceId} diperbarui: ${data.payment?.status?.toUpperCase()}.`,
      });
      await loadData();
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Aksi gagal dijalankan.",
      });
    } finally {
      setBusyRef(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
            Riwayat Transaksi & Saldo
          </h1>
          <p className="text-sm text-[#526071] mt-1">
            Data transaksi tersimpan di Neon PostgreSQL dan dapat disinkronkan
            kapan saja dengan BorderPay API.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadData({ sync: true })}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#E4E8EE] bg-white text-sm font-semibold text-[#0F172A] hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4 text-[#1D4ED8]", syncing && "animate-spin")} />
            <span>Sync BorderPay</span>
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1D4ED8] text-white text-sm font-semibold hover:bg-[#1E40AF] transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Buat Transaksi</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#E4E8EE] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#526071]">
            <span>Saldo Tersedia (Live API)</span>
            <Wallet className="h-4 w-4 text-[#1D4ED8]" />
          </div>
          <div className="font-mono-num text-2xl font-bold text-[#0F172A] mt-2">
            {balance ? formatIDR(balance.available) : "—"}
          </div>
          <div className="text-xs text-[#526071] mt-1">
            {balance
              ? `Pending: ${formatIDR(balance.pending)}`
              : balanceError || "Memuat GET /balance..."}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E4E8EE] bg-white p-5 shadow-2xs">
          <div className="text-xs font-medium text-[#526071]">
            Volume Lunas (Neon DB)
          </div>
          <div className="font-mono-num text-2xl font-bold text-teal-700 mt-2">
            {formatIDR(summary?.paidVolume ?? 0)}
          </div>
          <div className="text-xs text-[#526071] mt-1">
            {summary?.paidCount ?? 0} dari {summary?.totalCount ?? 0} transaksi lunas
          </div>
        </div>

        <div className="rounded-2xl border border-[#E4E8EE] bg-white p-5 shadow-2xs">
          <div className="text-xs font-medium text-[#526071]">
            Diterima Bersih Merchant
          </div>
          <div className="font-mono-num text-2xl font-bold text-[#0F172A] mt-2">
            {formatIDR(summary?.netMerchantReceives ?? 0)}
          </div>
          <div className="text-xs text-[#526071] mt-1">
            Total biaya kanal: {formatIDR(summary?.totalFees ?? 0)}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E4E8EE] bg-white p-5 shadow-2xs">
          <div className="text-xs font-medium text-[#526071]">
            Menunggu Pembayaran
          </div>
          <div className="font-mono-num text-2xl font-bold text-amber-700 mt-2">
            {summary?.pendingCount ?? 0}
          </div>
          <div className="text-xs text-[#526071] mt-1">
            Nilai pending: {formatIDR(summary?.pendingVolume ?? 0)}
          </div>
        </div>
      </div>

      {notice && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm flex items-start justify-between gap-3",
            notice.type === "success"
              ? "border-teal-200 bg-teal-50 text-teal-900"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          <div className="flex items-start gap-2.5">
            {notice.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-teal-600" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-current opacity-60 hover:opacity-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="rounded-2xl border border-[#E4E8EE] bg-white shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[#E4E8EE] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer",
                  statusFilter === tab.id
                    ? "bg-[#0F172A] text-white"
                    : "text-[#526071] hover:bg-slate-100 hover:text-[#0F172A]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="h-4 w-4 text-[#526071] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Reference ID, pembeli, item..."
              className="w-full rounded-lg border border-[#E4E8EE] bg-[#F7F8FA] pl-9 pr-3 py-1.5 text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#1D4ED8]"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-sm text-[#526071]">
              <Loader2 className="h-5 w-5 animate-spin text-[#1D4ED8]" />
              <span>Memuat transaksi dari Neon PostgreSQL...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 px-4 text-center space-y-3">
              <div className="text-sm font-semibold text-[#0F172A]">
                Belum ada transaksi yang cocok
              </div>
              <p className="text-xs text-[#526071]">
                Buat transaksi demo pertama Anda di halaman Checkout Demo untuk
                melihat alur pembayaran real-time.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1D4ED8] text-white text-xs font-semibold hover:bg-[#1E40AF]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Mulai Checkout Demo</span>
              </Link>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E4E8EE] bg-[#F7F8FA]/80 text-[11px] font-semibold uppercase tracking-wider text-[#526071]">
                  <th className="py-3 px-4">Reference ID & Item</th>
                  <th className="py-3 px-4">Pembeli</th>
                  <th className="py-3 px-4">Metode</th>
                  <th className="py-3 px-4 text-right">Nominal / Bersih</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E8EE] text-sm">
                {rows.map((row) => {
                  const isPending = row.status === "pending";
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/pay/${encodeURIComponent(row.referenceId)}`}
                          className="font-mono-num text-xs font-bold text-[#1D4ED8] hover:underline"
                        >
                          {row.referenceId}
                        </Link>
                        <div className="text-xs text-[#526071] truncate max-w-[220px] mt-0.5">
                          {row.itemName}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-[#0F172A]">
                          {row.customerName}
                        </div>
                        {row.customerEmail && (
                          <div className="text-[11px] text-[#526071]">
                            {row.customerEmail}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-xs font-semibold text-[#0F172A]">
                          {getMethodLabel(row.method, row.bankCode)}
                        </span>
                        <div className="text-[10px] uppercase tracking-wider text-[#526071] mt-0.5">
                          {row.checkoutMode}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-mono-num text-xs font-bold text-[#0F172A]">
                          {formatIDR(row.customerPays)}
                        </div>
                        <div className="font-mono-num text-[11px] text-teal-700">
                          Net {formatIDR(row.merchantReceives)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#526071] whitespace-nowrap">
                        <div>{formatDateTime(row.createdAt)}</div>
                        {row.paidAt && (
                          <div className="text-[11px] text-teal-700">
                            Lunas: {formatDateTime(row.paidAt)}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && row.mode === "test" && (
                            <button
                              type="button"
                              title="Simulasikan Bayar Lunas (Test Mode)"
                              disabled={busyRef !== null}
                              onClick={() =>
                                runRowAction(row.referenceId, "simulate")
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 cursor-pointer disabled:opacity-50"
                            >
                              {busyRef === `${row.referenceId}:simulate` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Zap className="h-3.5 w-3.5" />
                              )}
                              <span>Simulasi</span>
                            </button>
                          )}

                          <button
                            type="button"
                            title="Cek Status dari BorderPay"
                            disabled={busyRef !== null}
                            onClick={() =>
                              runRowAction(row.referenceId, "refresh")
                            }
                            className="p-1.5 rounded-lg border border-[#E4E8EE] bg-white text-[#526071] hover:text-[#0F172A] hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw
                              className={cn(
                                "h-3.5 w-3.5",
                                busyRef === `${row.referenceId}:refresh` &&
                                  "animate-spin"
                              )}
                            />
                          </button>

                          {isPending && (
                            <button
                              type="button"
                              title="Batalkan Transaksi"
                              disabled={busyRef !== null}
                              onClick={() =>
                                runRowAction(row.referenceId, "cancel")
                              }
                              className="p-1.5 rounded-lg border border-red-200 bg-red-50/50 text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            title="Lihat Raw JSON"
                            onClick={() => setInspectPayment(row)}
                            className="p-1.5 rounded-lg border border-[#E4E8EE] bg-white text-[#526071] hover:text-[#0F172A] hover:bg-slate-50 cursor-pointer"
                          >
                            <Code2 className="h-3.5 w-3.5" />
                          </button>

                          <Link
                            href={`/pay/${encodeURIComponent(row.referenceId)}`}
                            title="Buka Halaman Pembayaran"
                            className="p-1.5 rounded-lg border border-[#E4E8EE] bg-white text-[#1D4ED8] hover:bg-blue-50"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Raw JSON Inspector */}
      {inspectPayment && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[1px] flex items-center justify-center p-4"
          onClick={() => setInspectPayment(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white border border-[#E4E8EE] shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#E4E8EE] flex items-center justify-between">
              <div>
                <div className="text-xs text-[#526071]">Detail JSON Transaksi</div>
                <div className="font-mono-num text-sm font-bold text-[#0F172A]">
                  {inspectPayment.referenceId}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectPayment(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-[#526071] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <JsonInspector
                title="Stored BorderPay API Payload"
                badge={inspectPayment.status.toUpperCase()}
                data={inspectPayment.rawResponse}
                maxHeightClass="max-h-[60vh]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
