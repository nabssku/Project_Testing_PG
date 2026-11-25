import { NextResponse } from "next/server";
import {
  BorderPayApiError,
  getBorderPayMode,
  getMaskedApiKey,
  getPaymentMethods,
} from "@/lib/borderpay";

export async function GET() {
  try {
    const methods = await getPaymentMethods();
    return NextResponse.json({
      mode: getBorderPayMode(),
      maskedApiKey: getMaskedApiKey(),
      methods,
    });
  } catch (error) {
    if (error instanceof BorderPayApiError) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
          details: error.details,
        },
        { status: error.status }
      );
    }
    return NextResponse.json(
      {
        error: "internal_error",
        message: "Gagal memuat daftar metode pembayaran dari BorderPay.",
      },
      { status: 500 }
    );
  }
}
