import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatIDR(amount: number | null | undefined): string {
  const safe = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(safe);
}

export function formatDateTime(
  value: string | Date | null | undefined
): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export interface FeeRuleInput {
  percent?: number;
  flat?: number;
  tiers?: Array<{ minAmount: number; percent: number; flat: number }>;
}

export function resolveActiveFeeTier(
  amount: number,
  fee?: FeeRuleInput | null
): { percent: number; flat: number } | null {
  if (!fee) return null;
  if (fee.tiers && fee.tiers.length > 0 && amount > 0) {
    const matched = [...fee.tiers]
      .sort((a, b) => b.minAmount - a.minAmount)
      .find((tier) => amount >= tier.minAmount);
    if (matched) {
      return { percent: matched.percent, flat: matched.flat };
    }
  }
  return { percent: fee.percent || 0, flat: fee.flat || 0 };
}

export function calculateEstimatedFee(
  amount: number,
  fee?: FeeRuleInput | null
): number {
  if (!fee || amount <= 0) return 0;
  const active = resolveActiveFeeTier(amount, fee);
  if (!active) return 0;
  const percentPart = Math.round((amount * active.percent) / 100);
  const flatPart = Math.round(active.flat);
  return percentPart + flatPart;
}

export function formatFeeRule(
  fee?: FeeRuleInput | null,
  amount?: number
): string {
  if (!fee) return "Sesuai kanal";
  const active =
    amount !== undefined ? resolveActiveFeeTier(amount, fee) : fee;
  if (!active) return "Sesuai kanal";
  const parts: string[] = [];
  if (active.percent && active.percent > 0) parts.push(`${active.percent}%`);
  if (active.flat && active.flat > 0) parts.push(formatIDR(active.flat));
  return parts.length > 0 ? parts.join(" + ") : "Gratis";
}

export function generateReferenceId(prefix = "ORD"): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${y}${m}${d}-${rand}`;
}

export function getStatusMeta(status: string): {
  label: string;
  className: string;
  dotClass: string;
} {
  switch (status.toLowerCase()) {
    case "paid":
    case "completed":
    case "success":
      return {
        label: status.toLowerCase() === "completed" ? "Selesai" : "Lunas",
        className:
          "bg-teal-50 text-teal-800 border border-teal-200/80",
        dotClass: "bg-teal-600",
      };
    case "pending":
    case "processing":
      return {
        label: "Menunggu Bayar",
        className:
          "bg-amber-50 text-amber-800 border border-amber-200/80",
        dotClass: "bg-amber-500",
      };
    case "expired":
      return {
        label: "Kedaluwarsa",
        className:
          "bg-slate-100 text-slate-700 border border-slate-200",
        dotClass: "bg-slate-500",
      };
    case "failed":
    default:
      return {
        label: "Gagal",
        className:
          "bg-red-50 text-red-700 border border-red-200/80",
        dotClass: "bg-red-600",
      };
  }
}

export function getMethodLabel(method: string, bankCode?: string | null): string {
  const m = method.toLowerCase();
  if (m === "qris") return "QRIS";
  if (m === "va") return bankCode ? `VA ${bankCode.toUpperCase()}` : "Virtual Account";
  if (m === "ewallet") return bankCode ? `E-Wallet ${bankCode.toUpperCase()}` : "E-Wallet";
  return method.toUpperCase();
}
