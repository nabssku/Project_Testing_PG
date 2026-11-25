"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import type { PaymentRecord, WebhookEventRecord } from "@/db/schema";
import { cn, formatDateTime, formatIDR } from "@/lib/format";
import { CopyButton } from "./CopyButton";
import { JsonInspector } from "./JsonInspector";

interface WebhookConfig {
  mode: string;
  tokenConfigured: boolean;
  webhookEndpoint: string;
}

export function WebhooksClient() {
  const [events, setEvents] = useState<WebhookEventRecord[]>([]);
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form simulator
  const [selectedRef, setSelectedRef] = useState("");
  const [eventType, setEventType] = useState<
    "payment.paid" | "payment.expired" | "payment.failed"
  >("payment.paid");
  const [simulateInvalidToken, setSimulateInvalidToken] = useState(false);
  const [sending, setSending] = useState(false);
  const [simResult, setSimResult] = useState<{
    status: number;
    message: string;
    ok: boolean;
  } | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [evRes, payRes] = await Promise.all([
        fetch("/api/webhooks/events", { cache: "no-store" }),
        fetch("/api/payments", { cache: "no-store" }),
      ]);
      const evData = await evRes.json();
      const payData = await payRes.json();

      if (evRes.ok) {
        setEvents(evData.events || []);
        setConfig(evData.config || null);
      }
      if (payRes.ok) {
        const list = (payData.payments || []) as PaymentRecord[];
        setPayments(list);
        setSelectedRef((prev) => prev || list[0]?.referenceId || "");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [evRes, payRes] = await Promise.all([
          fetch("/api/webhooks/events", { cache: "no-store" }),
          fetch("/api/payments", { cache: "no-store" }),
        ]);
        const evData = await evRes.json();
        const payData = await payRes.json();
        if (!active) return;

        if (evRes.ok) {
          setEvents(evData.events || []);
          setConfig(evData.config || null);
        }
        if (payRes.ok) {
          const list = (payData.payments || []) as PaymentRecord[];
          setPayments(list);
          setSelectedRef((prev) => prev || list[0]?.referenceId || "");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSimulateWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRef.trim()) return;
    setSending(true);
    setSimResult(null);

    try {
      const res = await fetch("/api/webhooks/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceId: selectedRef.trim(),
          event: eventType,
          simulateInvalidToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Simulasi webhook gagal.");
      }
      setSimResult({
        status: data.simulatedHttpStatus,
        ok: data.simulatedHttpStatus === 200,
        message:
          data.response?.note ||
          data.response?.message ||
          `HTTP ${data.simulatedHttpStatus}`,
      });
      await loadAll();
    } catch (err) {
      setSimResult({
        status: 500,
        ok: false,
        message: err instanceof Error ? err.message : "Gagal mengirim simulasi.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
            Webhook Receiver & Inspector
          </h1>
          <p className="text-sm text-[#526071] mt-1">
            Menerima notifikasi real-time dari BorderPay dengan verifikasi{" "}
            <code className="font-mono-num text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              x-borderpay-token
            </code>
            , idempotency, dan penyimpanan audit ke Neon DB.
          </p>
        </div>
        <button
          type="button"
          onClick={loadAll}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#E4E8EE] bg-white text-sm font-semibold text-[#0F172A] hover:bg-slate-50 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4 text-[#1D4ED8]", loading && "animate-spin")} />
          <span>Muat Ulang Log</span>
        </button>
      </div>

      {/* Endpoint & Security Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 rounded-2xl border border-[#E4E8EE] bg-white p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-[#0F172A]">
              <Webhook className="h-4 w-4 text-[#1D4ED8]" />
              <span>Endpoint Penerima Webhook</span>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
                config?.tokenConfigured
                  ? "bg-teal-50 text-teal-800 border-teal-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              )}
            >
              {config?.tokenConfigured ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Token Verifikasi Aktif</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Token Belum Diatur</span>
                </>
              )}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F7F8FA] border border-[#E4E8EE] px-3.5 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2 py-0.5 rounded bg-[#0F172A] text-white font-mono-num text-[11px] font-bold">
                POST
              </span>
              <code className="font-mono-num text-xs text-[#0F172A] truncate">
                {config?.webhookEndpoint || "http://localhost:3000/api/webhooks/borderpay"}
              </code>
            </div>
            <CopyButton
              value={
                config?.webhookEndpoint ||
                "http://localhost:3000/api/webhooks/borderpay"
              }
              label="Salin URL"
            />
          </div>

          {!config?.tokenConfigured && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 leading-relaxed">
              <strong>Cara menghubungkan webhook publik BorderPay:</strong>{" "}
              Daftarkan URL publik (via Vercel / ngrok) ke dashboard BorderPay,
              salin verification token (<code className="font-mono-num">bpt_...</code>),
              lalu isi ke variabel{" "}
              <code className="font-mono-num">BORDERPAY_WEBHOOK_TOKEN</code> di{" "}
              <code className="font-mono-num">.env.local</code>. Selama kosong,
              request eksternal akan ditolak <code>401 Unauthorized</code> demi
              keamanan — gunakan Simulator Lokal di samping untuk pengujian.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-[#526071]">
            <div className="rounded-lg border border-[#E4E8EE] p-3">
              <div className="font-semibold text-[#0F172A]">
                1. Verifikasi Token (timingSafeEqual)
              </div>
              <p className="mt-0.5">
                Header <code>x-borderpay-token</code> dicocokkan konstan-waktu;
                tak cocok langsung balas <code>401</code>.
              </p>
            </div>
            <div className="rounded-lg border border-[#E4E8EE] p-3">
              <div className="font-semibold text-[#0F172A]">
                2. Idempoten & Status Final
              </div>
              <p className="mt-0.5">
                Event duplikat diabaikan dan status <code>paid</code> tidak
                pernah ditimpa oleh event <code>expired</code> yang datang telat.
              </p>
            </div>
            <div className="rounded-lg border border-[#E4E8EE] p-3">
              <div className="font-semibold text-[#0F172A]">
                3. Simpan Sebelum 200 OK
              </div>
              <p className="mt-0.5">
                Status transaksi & log audit ditulis ke Neon DB terlebih dahulu
                sebelum mengirim respons <code>200</code>.
              </p>
            </div>
            <div className="rounded-lg border border-[#E4E8EE] p-3">
              <div className="font-semibold text-[#0F172A]">
                4. Verifikasi Silang GET /payments
              </div>
              <p className="mt-0.5">
                Event riil <code>payment.paid</code> dikonfirmasi ulang ke API
                status BorderPay sebelum melunasi order.
              </p>
            </div>
          </div>
        </div>

        {/* Simulator Webhook Lokal */}
        <form
          onSubmit={handleSimulateWebhook}
          className="lg:col-span-5 rounded-2xl border border-[#E4E8EE] bg-white p-5 sm:p-6 shadow-2xs space-y-4"
        >
          <div>
            <h2 className="text-sm font-bold text-[#0F172A]">
              Simulator Webhook Lokal (Test Mode)
            </h2>
            <p className="text-xs text-[#526071] mt-0.5">
              Uji verifikasi token, pembaruan status, dan idempotency langsung
              tanpa perlu tunnel publik.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Target Transaksi (Reference ID)
              </label>
              {payments.length > 0 ? (
                <select
                  value={selectedRef}
                  onChange={(e) => setSelectedRef(e.target.value)}
                  className="w-full rounded-lg border border-[#E4E8EE] bg-white px-3 py-2 text-xs font-mono-num text-[#0F172A] focus:outline-none focus:border-[#1D4ED8]"
                >
                  {payments.map((p) => (
                    <option key={p.id} value={p.referenceId}>
                      {p.referenceId} · {p.status.toUpperCase()} ·{" "}
                      {formatIDR(p.customerPays)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={selectedRef}
                  onChange={(e) => setSelectedRef(e.target.value)}
                  placeholder="Contoh: ORD-20261125-ABC123"
                  className="w-full rounded-lg border border-[#E4E8EE] px-3 py-2 text-xs font-mono-num text-[#0F172A]"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Jenis Event (x-borderpay-event)
              </label>
              <select
                value={eventType}
                onChange={(e) =>
                  setEventType(
                    e.target.value as
                      | "payment.paid"
                      | "payment.expired"
                      | "payment.failed"
                  )
                }
                className="w-full rounded-lg border border-[#E4E8EE] bg-white px-3 py-2 text-xs font-mono-num text-[#0F172A] focus:outline-none focus:border-[#1D4ED8]"
              >
                <option value="payment.paid">payment.paid (Lunas)</option>
                <option value="payment.expired">
                  payment.expired (Kedaluwarsa)
                </option>
                <option value="payment.failed">payment.failed (Gagal)</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs text-[#526071] cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={simulateInvalidToken}
                onChange={(e) => setSimulateInvalidToken(e.target.checked)}
                className="rounded border-slate-300 text-[#1D4ED8] focus:ring-[#1D4ED8]"
              />
              <span>
                Kirim dengan <strong>token salah</strong> untuk menguji respons{" "}
                <code>401 Unauthorized</code>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={sending || !selectedRef.trim()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F172A] hover:bg-[#1D4ED8] text-white text-sm font-semibold px-4 py-2.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span>Kirim Simulasi Webhook</span>
          </button>

          {simResult && (
            <div
              className={cn(
                "rounded-xl border p-3 text-xs flex items-start gap-2",
                simResult.ok
                  ? "border-teal-200 bg-teal-50 text-teal-900"
                  : "border-red-200 bg-red-50 text-red-800"
              )}
            >
              {simResult.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-teal-600" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
              )}
              <div>
                <div className="font-mono-num font-bold">
                  HTTP {simResult.status}
                </div>
                <div className="mt-0.5">{simResult.message}</div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Audit Log Tabel */}
      <div className="rounded-2xl border border-[#E4E8EE] bg-white shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E4E8EE] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#0F172A]">
              Log Audit Webhook Masuk (Neon DB)
            </h2>
            <p className="text-xs text-[#526071]">
              Menampilkan 50 event terbaru lengkap dengan hasil validasi token
              dan pemrosesan idempoten.
            </p>
          </div>
          <span className="font-mono-num text-xs text-[#526071]">
            {events.length} event
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-sm text-[#526071]">
            <Loader2 className="h-5 w-5 animate-spin text-[#1D4ED8]" />
            <span>Memuat riwayat webhook...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#526071]">
            Belum ada event webhook tercatat. Gunakan simulator di atas untuk
            menguji alur penerimaan webhook.
          </div>
        ) : (
          <div className="divide-y divide-[#E4E8EE]">
            {events.map((ev) => {
              const isOpen = expandedId === ev.id;
              return (
                <div key={ev.id} className="p-4 hover:bg-slate-50/70">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded font-mono-num text-[11px] font-bold border",
                          ev.tokenValid
                            ? "bg-teal-50 text-teal-800 border-teal-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        )}
                      >
                        {ev.tokenValid ? "200 OK" : "401 DITOLAK"}
                      </span>
                      <span className="font-mono-num text-xs font-bold text-[#0F172A]">
                        {ev.event}
                      </span>
                      {ev.referenceId && (
                        <span className="font-mono-num text-xs text-[#1D4ED8] bg-blue-50 px-2 py-0.5 rounded">
                          {ev.referenceId}
                        </span>
                      )}
                      <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {ev.mode}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#526071]">
                        {formatDateTime(ev.receivedAt)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedId(isOpen ? null : ev.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E4E8EE] bg-white text-xs font-medium text-[#0F172A] hover:bg-slate-50 cursor-pointer"
                      >
                        <span>Payload</span>
                        {isOpen ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {ev.processingNote && (
                    <p className="text-xs text-[#526071] mt-2">
                      {ev.processingNote}
                    </p>
                  )}

                  {isOpen && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <JsonInspector
                        title="Headers (Token Ter-mask)"
                        data={ev.headers}
                        maxHeightClass="max-h-56"
                      />
                      <JsonInspector
                        title="Webhook Body Payload"
                        data={ev.payload}
                        maxHeightClass="max-h-56"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
