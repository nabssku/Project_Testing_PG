import { NextRequest, NextResponse } from "next/server";
import {
  isWebhookTokenConfigured,
  verifyWebhookToken,
} from "@/lib/webhook";
import {
  processBorderPayWebhook,
  type BorderPayWebhookPayload,
} from "@/lib/webhook-processor";

export async function POST(request: NextRequest) {
  let payload: BorderPayWebhookPayload;
  try {
    payload = (await request.json()) as BorderPayWebhookPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json", message: "Body webhook harus berupa JSON valid." },
      { status: 400 }
    );
  }

  const eventHeader = request.headers.get("x-borderpay-event");
  const modeHeader = request.headers.get("x-borderpay-mode");
  const tokenHeader = request.headers.get("x-borderpay-token");

  const tokenConfigured = isWebhookTokenConfigured();
  const tokenValid = tokenConfigured ? verifyWebhookToken(tokenHeader) : false;

  const result = await processBorderPayWebhook({
    eventHeader,
    modeHeader,
    tokenHeader,
    tokenValid,
    rejectionReason: !tokenConfigured
      ? "Ditolak (401): BORDERPAY_WEBHOOK_TOKEN belum diatur di .env.local. Tambahkan token bpt_... dari dashboard BorderPay."
      : undefined,
    payload,
    isLocalSimulation: false,
  });

  return NextResponse.json(result.body, { status: result.httpStatus });
}
