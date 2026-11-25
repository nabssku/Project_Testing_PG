import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { payments, webhookEvents } from "@/db/schema";
import { getBorderPayMode, isTestMode } from "@/lib/borderpay";
import { isWebhookTokenConfigured } from "@/lib/webhook";
import { processBorderPayWebhook } from "@/lib/webhook-processor";

const simulateWebhookSchema = z.object({
  referenceId: z.string().trim().min(1, "Pilih Reference ID transaksi."),
  event: z.enum(["payment.paid", "payment.expired", "payment.failed"]),
  simulateInvalidToken: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  try {
    const events = await db
      .select()
      .from(webhookEvents)
      .orderBy(desc(webhookEvents.receivedAt))
      .limit(50);

    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") ||
      request.nextUrl.origin;

    return NextResponse.json({
      events,
      config: {
        mode: getBorderPayMode(),
        tokenConfigured: isWebhookTokenConfigured(),
        webhookEndpoint: `${origin}/api/webhooks/borderpay`,
      },
    });
  } catch (error) {
    console.error("GET /api/webhooks/events error:", error);
    return NextResponse.json(
      { error: "database_error", message: "Gagal memuat riwayat webhook." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isTestMode()) {
    return NextResponse.json(
      {
        error: "live_mode_blocked",
        message: "Simulator webhook lokal hanya tersedia saat menggunakan API key test (bp_test_...).",
      },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = simulateWebhookSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: parsed.error.issues[0]?.message || "Input simulasi tidak valid.",
        },
        { status: 422 }
      );
    }

    const { referenceId, event, simulateInvalidToken } = parsed.data;
    const payment = await db.query.payments.findFirst({
      where: eq(payments.referenceId, referenceId),
    });

    const statusFromEvent = event.replace("payment.", "");
    const payload = {
      event,
      mode: "test",
      data: {
        slug: "demo-borderpay-sandbox",
        reference_id: referenceId,
        order_id: referenceId,
        status: statusFromEvent,
        amount: payment?.customerPays ?? 150000,
        fee: payment?.fee ?? 1500,
        merchant_receives: payment?.merchantReceives ?? 148500,
        method: payment?.method ?? "qris",
      },
    };

    const result = await processBorderPayWebhook({
      eventHeader: event,
      modeHeader: "test",
      tokenHeader: simulateInvalidToken
        ? "bpt_invalid_token_test"
        : process.env.BORDERPAY_WEBHOOK_TOKEN?.trim() || "bpt_local_simulator_valid",
      tokenValid: !simulateInvalidToken,
      rejectionReason: simulateInvalidToken
        ? "Simulasi token salah (401): header x-borderpay-token ditolak sesuai aturan keamanan BorderPay."
        : undefined,
      payload,
      isLocalSimulation: true,
    });

    return NextResponse.json(
      {
        simulatedHttpStatus: result.httpStatus,
        response: result.body,
        eventRecord: result.record,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("POST /api/webhooks/events error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Gagal menjalankan simulasi webhook lokal." },
      { status: 500 }
    );
  }
}
