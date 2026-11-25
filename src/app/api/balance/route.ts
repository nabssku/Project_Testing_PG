import { NextResponse } from "next/server";
import { sql as dbSql } from "@/db";
import {
  BorderPayApiError,
  getBalance,
  getBorderPayMode,
  getMaskedApiKey,
} from "@/lib/borderpay";
import { isWebhookTokenConfigured } from "@/lib/webhook";

export async function GET() {
  let dbConnected = false;
  let dbError: string | null = null;

  try {
    await dbSql`SELECT 1`;
    dbConnected = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : "Koneksi Neon DB gagal";
  }

  let balance: { available: number; pending: number; currency: string } | null =
    null;
  let balanceError: string | null = null;

  try {
    const res = await getBalance();
    balance = {
      available: Number(res.available ?? 0),
      pending: Number(res.pending ?? 0),
      currency: res.currency || "IDR",
    };
  } catch (error) {
    if (error instanceof BorderPayApiError) {
      balanceError = error.message;
    } else {
      balanceError = "Gagal mengambil saldo dari BorderPay.";
    }
  }

  return NextResponse.json({
    mode: getBorderPayMode(),
    maskedApiKey: getMaskedApiKey(),
    webhookTokenConfigured: isWebhookTokenConfigured(),
    database: {
      connected: dbConnected,
      provider: "Neon PostgreSQL",
      error: dbError,
    },
    balance,
    balanceError,
  });
}
