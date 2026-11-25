export type PaymentMethodType = "qris" | "va" | "ewallet";
export type PaymentStatus = "pending" | "paid" | "expired" | "failed";
export type BorderPayMode = "test" | "live";

export interface BorderPayFeeTier {
  minAmount: number;
  percent: number;
  flat: number;
}

export interface BorderPayFee {
  percent: number;
  flat: number;
  tiers?: BorderPayFeeTier[];
}

export interface BorderPayChannel {
  code: string;
  name: string;
  enabled: boolean;
  fee: BorderPayFee;
}

export interface BorderPayMethodsResponse {
  qris: {
    enabled: boolean;
    fee: BorderPayFee;
  };
  va: {
    enabled: boolean;
    banks: BorderPayChannel[];
  };
  ewallet: {
    enabled: boolean;
    fee?: BorderPayFee;
    wallets: BorderPayChannel[];
  };
}

export interface CreatePaymentPayload {
  amount: number;
  method: PaymentMethodType;
  bank_code?: string;
  reference_id?: string;
  return_url?: string;
}

export interface BorderPayCreatePaymentResponse {
  reference_id: string;
  status: PaymentStatus;
  amount: number;
  customer_pays?: number;
  merchant_receives?: number;
  fee?: number;
  fee_borne_by?: string;
  pay_url?: string;
  return_url?: string;
  qr_string?: string;
  va_number?: string;
  va_bank?: string;
  checkout_url?: string;
  expires_at?: string;
  [key: string]: unknown;
}

export interface BorderPayStatusResponse {
  reference_id: string;
  amount: number;
  order_amount?: number;
  customer_pays?: number;
  merchant_receives?: number;
  fee?: number;
  fee_borne_by?: string;
  method?: string;
  status: PaymentStatus;
  paid_at?: string | null;
  expires_at?: string | null;
  [key: string]: unknown;
}

export interface BorderPaySimulateResponse {
  reference_id: string;
  status: PaymentStatus;
  [key: string]: unknown;
}

export interface BorderPayCancelResponse {
  reference_id: string;
  status: PaymentStatus;
  [key: string]: unknown;
}

export interface BorderPayBalanceResponse {
  available: number;
  pending: number;
  currency: string;
  [key: string]: unknown;
}

export interface BorderPayRemotePayment {
  reference_id: string;
  amount: number;
  method: string;
  status: string;
  created_at?: string;
  paid_at?: string | null;
  [key: string]: unknown;
}

export interface BorderPayRemotePaymentsResponse {
  data: BorderPayRemotePayment[];
}

export interface CreateDisbursementPayload {
  amount: number;
  bank_code: string;
  account_number: string;
  account_name: string;
  reference_id?: string;
}

export interface BorderPayDisbursementResponse {
  reference_id: string;
  status: string;
  amount: number;
  fee?: number;
  total_deducted?: number;
  bank_code?: string;
  account_number?: string;
  processed_at?: string | null;
  fail_reason?: string | null;
  [key: string]: unknown;
}

const ERROR_MESSAGES: Record<string, string> = {
  amount_below_min:
    "Nominal di bawah batas minimum metode ini (QRIS & E-Wallet min Rp 1.000, Virtual Account min Rp 10.000).",
  amount_above_max:
    "Nominal melebihi batas maksimum yang diizinkan oleh metode/bank yang dipilih.",
  bank_required:
    "Kode bank/wallet wajib dipilih untuk metode Virtual Account dan E-Wallet.",
  bank_not_allowed:
    "Bank atau kanal pembayaran yang dipilih saat ini sedang dinonaktifkan.",
  bank_unavailable:
    "Bank atau penyedia kanal pembayaran sedang tidak tersedia sementara.",
  kyc_required:
    "Akun memerlukan verifikasi KYC di dashboard BorderPay sebelum menggunakan fitur disbursement.",
  insufficient_balance:
    "Saldo BorderPay tidak mencukupi untuk nominal disbursement beserta biayanya.",
  below_min: "Nominal disbursement di bawah batas minimum (Rp 10.000).",
  bank_unsupported: "Kode bank tujuan belum didukung untuk disbursement.",
  invalid_account: "Nomor atau nama rekening tujuan tidak valid.",
  account_frozen: "Akun sedang dibekukan dan tidak dapat memproses payout.",
};

export class BorderPayApiError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "BorderPayApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function getApiKey(): string {
  const key = process.env.BORDERPAY_API_KEY?.trim();
  if (!key) {
    throw new BorderPayApiError(
      500,
      "missing_api_key",
      "BORDERPAY_API_KEY belum dikonfigurasi di .env.local."
    );
  }
  return key;
}

function getBaseUrl(): string {
  return (
    process.env.BORDERPAY_BASE_URL?.trim().replace(/\/+$/, "") ||
    "https://borderpay.id/api/v1"
  );
}

export function getBorderPayMode(): BorderPayMode {
  const key = process.env.BORDERPAY_API_KEY?.trim() || "";
  return key.startsWith("bp_live_") ? "live" : "test";
}

export function isTestMode(): boolean {
  return getBorderPayMode() === "test";
}

export function getMaskedApiKey(): string {
  const key = process.env.BORDERPAY_API_KEY?.trim() || "";
  if (!key) return "Belum diatur";
  if (key.length <= 14) return `${key.slice(0, 7)}••••`;
  return `${key.slice(0, 11)}••••${key.slice(-4)}`;
}

async function borderPayFetch<T>(
  endpoint: string,
  init: RequestInit = {},
  attempt = 0
): Promise<T> {
  const apiKey = getApiKey();
  const url = `${getBaseUrl()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const method = (init.method || "GET").toUpperCase();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {}),
      },
    });

    const rawText = await response.text();
    let parsed: unknown = null;
    if (rawText) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = { raw: rawText };
      }
    }

    if (!response.ok) {
      const obj =
        parsed && typeof parsed === "object"
          ? (parsed as Record<string, unknown>)
          : {};
      const code = String(
        obj.error || obj.code || `http_${response.status}`
      );
      const fallbackMessage =
        response.status === 409
          ? "Transaksi yang sudah lunas tidak dapat diubah atau dibatalkan."
          : response.status === 401
            ? "API Key BorderPay tidak valid atau tidak memiliki izin."
            : response.status === 404
              ? "Data transaksi tidak ditemukan di BorderPay."
              : `Permintaan ke BorderPay gagal (HTTP ${response.status}).`;

      const message =
        ERROR_MESSAGES[code] ||
        (typeof obj.message === "string" && obj.message) ||
        fallbackMessage;

      throw new BorderPayApiError(response.status, code, message, parsed);
    }

    return parsed as T;
  } catch (error) {
    if (error instanceof BorderPayApiError) {
      throw error;
    }
    if (method === "GET" && attempt < 1) {
      await new Promise((r) => setTimeout(r, 400));
      return borderPayFetch<T>(endpoint, init, attempt + 1);
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new BorderPayApiError(
        504,
        "timeout",
        "Koneksi ke API BorderPay melebihi batas waktu (20 detik)."
      );
    }
    throw new BorderPayApiError(
      502,
      "network_error",
      error instanceof Error
        ? `Gagal terhubung ke BorderPay: ${error.message}`
        : "Gagal terhubung ke server BorderPay."
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function getPaymentMethods(): Promise<BorderPayMethodsResponse> {
  return borderPayFetch<BorderPayMethodsResponse>("/payment-methods", {
    method: "GET",
  });
}

export async function createPayment(
  payload: CreatePaymentPayload
): Promise<BorderPayCreatePaymentResponse> {
  return borderPayFetch<BorderPayCreatePaymentResponse>("/payments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getPaymentStatus(
  referenceId: string
): Promise<BorderPayStatusResponse> {
  return borderPayFetch<BorderPayStatusResponse>(
    `/payments/${encodeURIComponent(referenceId)}`,
    { method: "GET" }
  );
}

export async function listRemotePayments(): Promise<BorderPayRemotePaymentsResponse> {
  const res = await borderPayFetch<
    BorderPayRemotePaymentsResponse | BorderPayRemotePayment[]
  >("/payments", { method: "GET" });

  if (Array.isArray(res)) {
    return { data: res };
  }
  return { data: Array.isArray(res?.data) ? res.data : [] };
}

export async function simulatePayment(
  referenceId: string
): Promise<BorderPaySimulateResponse> {
  if (!isTestMode()) {
    throw new BorderPayApiError(
      403,
      "live_mode_blocked",
      "Simulasi pembayaran hanya dapat dijalankan menggunakan API key mode test (bp_test_...)."
    );
  }
  return borderPayFetch<BorderPaySimulateResponse>(
    `/payments/${encodeURIComponent(referenceId)}/simulate`,
    { method: "POST" }
  );
}

export async function cancelPayment(
  referenceId: string
): Promise<BorderPayCancelResponse> {
  return borderPayFetch<BorderPayCancelResponse>(
    `/payments/${encodeURIComponent(referenceId)}/cancel`,
    { method: "POST" }
  );
}

export async function getBalance(): Promise<BorderPayBalanceResponse> {
  return borderPayFetch<BorderPayBalanceResponse>("/balance", {
    method: "GET",
  });
}

export async function createDisbursement(
  payload: CreateDisbursementPayload
): Promise<BorderPayDisbursementResponse> {
  return borderPayFetch<BorderPayDisbursementResponse>("/disbursements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listDisbursements(): Promise<
  BorderPayDisbursementResponse[]
> {
  const res = await borderPayFetch<
    BorderPayDisbursementResponse[] | { data?: BorderPayDisbursementResponse[] }
  >("/disbursements", { method: "GET" });

  if (Array.isArray(res)) return res;
  return Array.isArray(res?.data) ? res.data : [];
}
