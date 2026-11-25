"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Building2,
  Coffee,
  CupSoda,
  Headphones,
  LampDesk,
  Loader2,
  Lock,
  Minus,
  Plus,
  QrCode,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Wallet,
} from "lucide-react";
import type {
  BorderPayMethodsResponse,
  PaymentMethodType,
} from "@/lib/borderpay";
import { DEMO_PRODUCTS, type DemoProduct } from "@/lib/catalog";
import { cn, formatIDR } from "@/lib/format";

function ProductIcon({ icon }: { icon: DemoProduct["icon"] }) {
  switch (icon) {
    case "coffee":
      return <Coffee className="h-5 w-5" />;
    case "cup":
      return <CupSoda className="h-5 w-5" />;
    case "bag":
      return <ShoppingBag className="h-5 w-5" />;
    case "lamp":
      return <LampDesk className="h-5 w-5" />;
    case "headphones":
      return <Headphones className="h-5 w-5" />;
    case "book":
      return <BookOpen className="h-5 w-5" />;
  }
}

export function CheckoutStudio() {
  const router = useRouter();

  // Keranjang belanja (default 1 produk pertama agar langsung siap uji checkout)
  const [cart, setCart] = useState<Record<string, number>>({
    [DEMO_PRODUCTS[0].id]: 1,
  });

  // Detail pembeli
  const [customerName, setCustomerName] = useState("Budi Santoso");
  const [customerEmail, setCustomerEmail] = useState("budi@contoh.id");

  // Metode pembayaran dari BorderPay
  const [methodsData, setMethodsData] =
    useState<BorderPayMethodsResponse | null>(null);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [methodsError, setMethodsError] = useState<string | null>(null);

  const [selectedMethod, setSelectedMethod] =
    useState<PaymentMethodType>("qris");
  const [selectedBankCode, setSelectedBankCode] = useState<string>("");

  // State submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const applyMethodsResponse = useCallback((m: BorderPayMethodsResponse) => {
    setMethodsData(m);
    if (m.qris?.enabled) {
      setSelectedMethod("qris");
      setSelectedBankCode("");
    } else if (m.va?.enabled && m.va.banks?.some((b) => b.enabled)) {
      setSelectedMethod("va");
      setSelectedBankCode(m.va.banks.find((b) => b.enabled)?.code || "");
    } else if (m.ewallet?.enabled && m.ewallet.wallets?.some((w) => w.enabled)) {
      setSelectedMethod("ewallet");
      setSelectedBankCode(m.ewallet.wallets.find((w) => w.enabled)?.code || "");
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/payment-methods", { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          throw new Error(data.message || "Gagal memuat metode pembayaran.");
        }
        applyMethodsResponse(data.methods as BorderPayMethodsResponse);
      } catch (err) {
        if (!active) return;
        setMethodsError(
          err instanceof Error
            ? err.message
            : "Gagal memuat pilihan pembayaran."
        );
      } finally {
        if (active) setMethodsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [applyMethodsResponse]);

  const cartItems = useMemo(() => {
    return DEMO_PRODUCTS.filter((p) => (cart[p.id] || 0) > 0).map((p) => ({
      product: p,
      qty: cart[p.id],
      subtotal: p.price * cart[p.id],
    }));
  }, [cart]);

  const totalItems = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.qty, 0),
    [cartItems]
  );

  const totalAmount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.subtotal, 0),
    [cartItems]
  );

  const itemSummaryText = useMemo(() => {
    if (cartItems.length === 0) return "Pesanan NusaStore";
    const text = cartItems
      .map((item) =>
        item.qty > 1
          ? `${item.product.name} (x${item.qty})`
          : item.product.name
      )
      .join(", ");
    return text.length > 175 ? `${text.slice(0, 172)}...` : text;
  }, [cartItems]);

  const activeBanks = useMemo(
    () => (methodsData?.va?.banks || []).filter((b) => b.enabled),
    [methodsData]
  );

  const activeWallets = useMemo(
    () => (methodsData?.ewallet?.wallets || []).filter((w) => w.enabled),
    [methodsData]
  );

  const minAmount = selectedMethod === "va" ? 10000 : 1000;
  const needsBankCode = selectedMethod === "va" || selectedMethod === "ewallet";
  const isAmountValid = totalAmount >= minAmount;

  const isSelectedMethodReady = useMemo(() => {
    if (!methodsData) return false;
    if (selectedMethod === "qris") return Boolean(methodsData.qris?.enabled);
    if (selectedMethod === "va") {
      return (
        Boolean(methodsData.va?.enabled) &&
        activeBanks.some((b) => b.code === selectedBankCode)
      );
    }
    if (selectedMethod === "ewallet") {
      return (
        Boolean(methodsData.ewallet?.enabled) &&
        activeWallets.some((w) => w.code === selectedBankCode)
      );
    }
    return false;
  }, [
    methodsData,
    selectedMethod,
    selectedBankCode,
    activeBanks,
    activeWallets,
  ]);

  function updateQty(productId: string, delta: number) {
    setSubmitError(null);
    setCart((prev) => {
      const nextQty = (prev[productId] || 0) + delta;
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: nextQty };
    });
  }

  function handleSelectMethod(next: PaymentMethodType) {
    setSelectedMethod(next);
    setSubmitError(null);
    if (next === "qris") {
      setSelectedBankCode("");
    } else if (next === "va") {
      setSelectedBankCode(activeBanks[0]?.code || "");
    } else if (next === "ewallet") {
      setSelectedBankCode(activeWallets[0]?.code || "");
    }
  }

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (cartItems.length === 0) {
      setSubmitError("Tambahkan minimal 1 produk ke keranjang terlebih dahulu.");
      return;
    }

    if (!isAmountValid) {
      setSubmitError(
        `Total belanja minimal ${formatIDR(minAmount)} untuk metode pembayaran ini.`
      );
      return;
    }

    if (needsBankCode && !selectedBankCode) {
      setSubmitError("Silakan pilih bank atau e-wallet terlebih dahulu.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: totalAmount,
          method: selectedMethod,
          bankCode: needsBankCode ? selectedBankCode : undefined,
          customerName: customerName.trim() || "Pelanggan",
          customerEmail: customerEmail.trim() || undefined,
          itemName: itemSummaryText,
          checkoutMode: "direct",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Gagal memproses pembayaran.");
      }

      router.push(`/pay/${encodeURIComponent(data.payment.referenceId)}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Terjadi kendala saat membuat pesanan."
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Toko Simpel */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
            Katalog Produk
          </h1>
          <p className="text-sm text-[#526071] mt-0.5">
            Pilih produk yang ingin dibeli, lalu selesaikan pembayaran secara
            instan.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#526071]">
          <ShoppingCart className="h-4 w-4 text-[#1D4ED8]" />
          <span>{totalItems} item di keranjang</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri — Katalog Produk E-Commerce */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DEMO_PRODUCTS.map((product) => {
            const qty = cart[product.id] || 0;
            const inCart = qty > 0;

            return (
              <div
                key={product.id}
                className={cn(
                  "rounded-2xl border bg-white p-5 flex flex-col justify-between transition-all shadow-2xs",
                  inCart
                    ? "border-[#1D4ED8] ring-2 ring-blue-500/10"
                    : "border-[#E4E8EE] hover:border-slate-300"
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={cn(
                        "h-11 w-11 rounded-xl border flex items-center justify-center shrink-0",
                        product.accent
                      )}
                    >
                      <ProductIcon icon={product.icon} />
                    </div>
                    <span className="text-[11px] font-medium text-[#526071] bg-[#F7F8FA] border border-[#E4E8EE] px-2.5 py-0.5 rounded-full">
                      {product.category}
                    </span>
                  </div>

                  <h2 className="font-bold text-[15px] text-[#0F172A] mt-4">
                    {product.name}
                  </h2>
                  <p className="text-xs text-[#526071] mt-1 leading-relaxed line-clamp-2">
                    {product.description}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-100">
                  <div className="font-mono-num font-bold text-base text-[#0F172A]">
                    {formatIDR(product.price)}
                  </div>

                  {inCart ? (
                    <div className="inline-flex items-center gap-1 rounded-lg border border-[#E4E8EE] bg-[#F7F8FA] p-0.5">
                      <button
                        type="button"
                        aria-label={`Kurangi ${product.name}`}
                        onClick={() => updateQty(product.id, -1)}
                        className="h-7 w-7 rounded-md bg-white hover:bg-slate-100 flex items-center justify-center text-[#0F172A] border border-[#E4E8EE] cursor-pointer"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-7 text-center text-xs font-mono-num font-bold text-[#0F172A]">
                        {qty}
                      </span>
                      <button
                        type="button"
                        aria-label={`Tambah ${product.name}`}
                        onClick={() => updateQty(product.id, 1)}
                        className="h-7 w-7 rounded-md bg-[#1D4ED8] hover:bg-[#1E40AF] flex items-center justify-center text-white cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => updateQty(product.id, 1)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E4E8EE] bg-white hover:border-[#1D4ED8] hover:text-[#1D4ED8] text-xs font-semibold text-[#0F172A] transition-colors cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Tambah</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Kolom Kanan — Ringkasan Keranjang & Pembayaran */}
        <form
          onSubmit={handleCheckout}
          className="lg:col-span-5 rounded-2xl border border-[#E4E8EE] bg-white p-5 sm:p-6 shadow-2xs space-y-5 lg:sticky lg:top-22"
        >
          <div className="flex items-center justify-between border-b border-[#E4E8EE] pb-3.5">
            <h2 className="text-base font-bold text-[#0F172A]">
              Ringkasan Pesanan
            </h2>
            <span className="text-xs font-medium text-[#526071]">
              {totalItems} produk
            </span>
          </div>

          {/* Daftar Keranjang */}
          {cartItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-[#F7F8FA] py-6 px-4 text-center text-xs text-[#526071]">
              Keranjang masih kosong. Pilih produk di sebelah kiri untuk mulai
              belanja.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
              {cartItems.map(({ product, qty, subtotal }) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-[#0F172A] truncate">
                      {product.name}
                    </div>
                    <div className="text-xs text-[#526071] font-mono-num">
                      {qty} × {formatIDR(product.price)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono-num text-xs font-semibold text-[#0F172A]">
                      {formatIDR(subtotal)}
                    </span>
                    <button
                      type="button"
                      title="Hapus dari keranjang"
                      onClick={() => updateQty(product.id, -qty)}
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Data Pembeli */}
          <div className="pt-4 border-t border-[#E4E8EE] space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#526071]">
              Data Pembeli
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#526071] mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nama Anda"
                  className="w-full rounded-lg border border-[#E4E8EE] bg-white px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-blue-500/15"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#526071] mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="email@contoh.id"
                  className="w-full rounded-lg border border-[#E4E8EE] bg-white px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-blue-500/15"
                />
              </div>
            </div>
          </div>

          {/* Metode Pembayaran */}
          <div className="pt-4 border-t border-[#E4E8EE] space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#526071]">
              Metode Pembayaran
            </div>

            {methodsLoading ? (
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-14 rounded-xl bg-slate-100 animate-pulse"
                  />
                ))}
              </div>
            ) : methodsError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{methodsError}</span>
              </div>
            ) : methodsData ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {methodsData.qris?.enabled && (
                    <button
                      type="button"
                      onClick={() => handleSelectMethod("qris")}
                      className={cn(
                        "rounded-xl border p-2.5 flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer",
                        selectedMethod === "qris"
                          ? "border-[#1D4ED8] bg-blue-50/50 text-[#1D4ED8] ring-2 ring-blue-500/15"
                          : "border-[#E4E8EE] text-[#0F172A] hover:border-slate-300"
                      )}
                    >
                      <QrCode className="h-4 w-4" />
                      <span className="text-xs font-semibold">QRIS</span>
                    </button>
                  )}

                  {methodsData.va?.enabled && activeBanks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSelectMethod("va")}
                      className={cn(
                        "rounded-xl border p-2.5 flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer",
                        selectedMethod === "va"
                          ? "border-[#1D4ED8] bg-blue-50/50 text-[#1D4ED8] ring-2 ring-blue-500/15"
                          : "border-[#E4E8EE] text-[#0F172A] hover:border-slate-300"
                      )}
                    >
                      <Building2 className="h-4 w-4" />
                      <span className="text-xs font-semibold">
                        Virtual Account
                      </span>
                    </button>
                  )}

                  {methodsData.ewallet?.enabled && activeWallets.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSelectMethod("ewallet")}
                      className={cn(
                        "rounded-xl border p-2.5 flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer",
                        selectedMethod === "ewallet"
                          ? "border-[#1D4ED8] bg-blue-50/50 text-[#1D4ED8] ring-2 ring-blue-500/15"
                          : "border-[#E4E8EE] text-[#0F172A] hover:border-slate-300"
                      )}
                    >
                      <Wallet className="h-4 w-4" />
                      <span className="text-xs font-semibold">E-Wallet</span>
                    </button>
                  )}
                </div>

                {/* Pilihan Bank VA */}
                {selectedMethod === "va" && activeBanks.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {activeBanks.map((bank) => {
                      const picked = selectedBankCode === bank.code;
                      return (
                        <button
                          key={bank.code}
                          type="button"
                          onClick={() => setSelectedBankCode(bank.code)}
                          className={cn(
                            "rounded-lg border px-2.5 py-2 text-xs font-semibold transition-all truncate cursor-pointer",
                            picked
                              ? "border-[#1D4ED8] bg-blue-50 text-[#1D4ED8]"
                              : "border-[#E4E8EE] bg-[#F7F8FA] text-[#0F172A] hover:bg-white hover:border-slate-300"
                          )}
                        >
                          {bank.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Pilihan E-Wallet */}
                {selectedMethod === "ewallet" && activeWallets.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {activeWallets.map((wallet) => {
                      const picked = selectedBankCode === wallet.code;
                      return (
                        <button
                          key={wallet.code}
                          type="button"
                          onClick={() => setSelectedBankCode(wallet.code)}
                          className={cn(
                            "rounded-lg border px-2.5 py-2 text-xs font-semibold transition-all truncate cursor-pointer",
                            picked
                              ? "border-[#1D4ED8] bg-blue-50 text-[#1D4ED8]"
                              : "border-[#E4E8EE] bg-[#F7F8FA] text-[#0F172A] hover:bg-white hover:border-slate-300"
                          )}
                        >
                          {wallet.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Total & Tombol Bayar */}
          <div className="pt-4 border-t border-[#E4E8EE] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#526071]">
                Total Pembayaran
              </span>
              <span className="font-mono-num text-xl font-extrabold text-[#0F172A]">
                {formatIDR(totalAmount)}
              </span>
            </div>

            {cartItems.length > 0 && !isAmountValid && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  Minimal belanja {formatIDR(minAmount)} untuk metode ini.
                </span>
              </div>
            )}

            {submitError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={
                submitting ||
                methodsLoading ||
                cartItems.length === 0 ||
                !isAmountValid ||
                !isSelectedMethodReady
              }
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-semibold text-sm px-5 py-3.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Menyiapkan Pembayaran...</span>
                </>
              ) : (
                <>
                  <span>Bayar Sekarang</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#526071]">
              <Lock className="h-3 w-3 text-teal-600" />
              <span>Pembayaran diproses aman oleh BorderPay</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
