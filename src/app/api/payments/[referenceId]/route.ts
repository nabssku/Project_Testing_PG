import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payments } from "@/db/schema";
import {
  BorderPayApiError,
  getBorderPayMode,
  getPaymentStatus,
} from "@/lib/borderpay";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ referenceId: string }> }
) {
  try {
    const { referenceId } = await context.params;
    const refresh = request.nextUrl.searchParams.get("refresh") === "true";

    let record = await db.query.payments.findFirst({
      where: eq(payments.referenceId, referenceId),
    });

    if (!record && !refresh) {
      return NextResponse.json(
        {
          error: "not_found",
          message: `Transaksi ${referenceId} tidak ditemukan di database.`,
        },
        { status: 404 }
      );
    }

    let remoteStatus = null;
    let refreshError: string | null = null;

    if (refresh || !record) {
      try {
        remoteStatus = await getPaymentStatus(referenceId);

        if (record) {
          // Status final "paid" tidak boleh turun kembali ke pending/expired
          const nextStatus =
            record.status === "paid"
              ? "paid"
              : remoteStatus.status || record.status;

          const nextPaidAt =
            remoteStatus.paid_at
              ? new Date(remoteStatus.paid_at)
              : nextStatus === "paid" && !record.paidAt
                ? new Date()
                : record.paidAt;

          const [updated] = await db
            .update(payments)
            .set({
              status: nextStatus,
              orderAmount: Number(
                remoteStatus.order_amount ?? record.orderAmount
              ),
              customerPays: Number(
                remoteStatus.customer_pays ??
                  remoteStatus.amount ??
                  record.customerPays
              ),
              merchantReceives: Number(
                remoteStatus.merchant_receives ?? record.merchantReceives
              ),
              fee: Number(remoteStatus.fee ?? record.fee),
              feeBorneBy: remoteStatus.fee_borne_by || record.feeBorneBy,
              paidAt: nextPaidAt,
              rawResponse: {
                ...(typeof record.rawResponse === "object" &&
                record.rawResponse !== null
                  ? (record.rawResponse as Record<string, unknown>)
                  : {}),
                latestStatusCheck: remoteStatus,
              },
              updatedAt: new Date(),
            })
            .where(eq(payments.id, record.id))
            .returning();

          record = updated;
        } else {
          // Transaksi ada di BorderPay tapi belum pernah dicatat di DB lokal
          const customerPays = Number(
            remoteStatus.customer_pays ?? remoteStatus.amount ?? 0
          );
          const orderAmount = Number(
            remoteStatus.order_amount ?? customerPays
          );
          const fee = Number(remoteStatus.fee ?? 0);
          const merchantReceives = Number(
            remoteStatus.merchant_receives ?? Math.max(0, customerPays - fee)
          );

          const [inserted] = await db
            .insert(payments)
            .values({
              referenceId: remoteStatus.reference_id || referenceId,
              customerName: "Pelanggan BorderPay",
              itemName: `Transaksi ${referenceId}`,
              orderAmount,
              customerPays,
              merchantReceives,
              fee,
              feeBorneBy: remoteStatus.fee_borne_by || "merchant",
              method: remoteStatus.method || "qris",
              checkoutMode: "hosted",
              status: remoteStatus.status || "pending",
              mode: getBorderPayMode(),
              paidAt: remoteStatus.paid_at
                ? new Date(remoteStatus.paid_at)
                : null,
              rawResponse: remoteStatus,
            })
            .returning();

          record = inserted;
        }
      } catch (err) {
        if (!record) {
          if (err instanceof BorderPayApiError) {
            return NextResponse.json(
              { error: err.code, message: err.message, details: err.details },
              { status: err.status }
            );
          }
          throw err;
        }
        refreshError =
          err instanceof BorderPayApiError
            ? err.message
            : "Gagal memuat status terbaru dari BorderPay.";
      }
    }

    return NextResponse.json({
      payment: record,
      remoteStatus,
      refreshError,
    });
  } catch (error) {
    console.error("GET /api/payments/[referenceId] error:", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message: "Gagal mengambil detail transaksi.",
      },
      { status: 500 }
    );
  }
}
