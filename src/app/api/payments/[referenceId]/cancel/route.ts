import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { BorderPayApiError, cancelPayment } from "@/lib/borderpay";

export async function POST(
  _request: Request,
  context: { params: Promise<{ referenceId: string }> }
) {
  try {
    const { referenceId } = await context.params;
    const existing = await db.query.payments.findFirst({
      where: eq(payments.referenceId, referenceId),
    });

    if (existing?.status === "paid") {
      return NextResponse.json(
        {
          error: "already_paid",
          message: "Transaksi yang sudah lunas tidak dapat dibatalkan.",
        },
        { status: 409 }
      );
    }

    const cancelRes = await cancelPayment(referenceId);

    let updated = existing || null;
    if (existing) {
      const [row] = await db
        .update(payments)
        .set({
          status: cancelRes.status || "expired",
          rawResponse: {
            ...(typeof existing.rawResponse === "object" &&
            existing.rawResponse !== null
              ? (existing.rawResponse as Record<string, unknown>)
              : {}),
            cancelResponse: cancelRes,
          },
          updatedAt: new Date(),
        })
        .where(eq(payments.id, existing.id))
        .returning();
      updated = row;
    }

    return NextResponse.json({
      payment: updated,
      cancelResponse: cancelRes,
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
    console.error("POST /api/payments/[referenceId]/cancel error:", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message: "Gagal membatalkan transaksi.",
      },
      { status: 500 }
    );
  }
}
