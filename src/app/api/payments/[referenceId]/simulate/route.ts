import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { payments } from "@/db/schema";
import {
  BorderPayApiError,
  getPaymentStatus,
  simulatePayment,
} from "@/lib/borderpay";

export async function POST(
  _request: Request,
  context: { params: Promise<{ referenceId: string }> }
) {
  try {
    const { referenceId } = await context.params;

    const existing = await db.query.payments.findFirst({
      where: eq(payments.referenceId, referenceId),
    });

    const simRes = await simulatePayment(referenceId);

    // Tarik detail status terbaru untuk memastikan paid_at dan rincian biaya final akurat
    let statusRes = null;
    try {
      statusRes = await getPaymentStatus(referenceId);
    } catch {
      // Tetap lanjut menggunakan hasil simulate bila status check lambat
    }

    let updated = existing || null;
    if (existing) {
      const [row] = await db
        .update(payments)
        .set({
          status: statusRes?.status || simRes.status || "paid",
          paidAt: statusRes?.paid_at ? new Date(statusRes.paid_at) : new Date(),
          customerPays: statusRes?.customer_pays
            ? Number(statusRes.customer_pays)
            : existing.customerPays,
          merchantReceives: statusRes?.merchant_receives
            ? Number(statusRes.merchant_receives)
            : existing.merchantReceives,
          fee:
            statusRes?.fee !== undefined ? Number(statusRes.fee) : existing.fee,
          rawResponse: {
            ...(typeof existing.rawResponse === "object" &&
            existing.rawResponse !== null
              ? (existing.rawResponse as Record<string, unknown>)
              : {}),
            simulateResponse: simRes,
            ...(statusRes ? { latestStatusCheck: statusRes } : {}),
          },
          updatedAt: new Date(),
        })
        .where(eq(payments.id, existing.id))
        .returning();

      updated = row;
    }

    return NextResponse.json({
      payment: updated,
      simulateResponse: simRes,
      statusResponse: statusRes,
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
    console.error("POST /api/payments/[referenceId]/simulate error:", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message: "Gagal menjalankan simulasi pembayaran.",
      },
      { status: 500 }
    );
  }
}
