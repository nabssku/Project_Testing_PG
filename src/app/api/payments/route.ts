import { desc, eq, ilike, or, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { payments } from "@/db/schema";
import {
  BorderPayApiError,
  createPayment,
  getBorderPayMode,
  listRemotePayments,
} from "@/lib/borderpay";
import { generateReferenceId } from "@/lib/format";

const createPaymentSchema = z
  .object({
    amount: z.coerce
      .number()
      .int("Nominal harus berupa bilangan bulat Rupiah.")
      .positive("Nominal harus lebih dari 0."),
    method: z.enum(["qris", "va", "ewallet"]),
    bankCode: z
      .string()
      .trim()
      .max(32)
      .optional()
      .transform((v) => (v ? v.toUpperCase() : undefined)),
    referenceId: z
      .string()
      .trim()
      .max(64, "Reference ID maksimal 64 karakter.")
      .regex(
        /^[a-zA-Z0-9._-]*$/,
        "Reference ID hanya boleh berisi huruf, angka, titik (.), strip (-), dan garis bawah (_)."
      )
      .optional(),
    customerName: z
      .string()
      .trim()
      .min(1, "Nama pembeli wajib diisi.")
      .max(120),
    customerEmail: z
      .string()
      .trim()
      .email("Format email tidak valid.")
      .optional()
      .or(z.literal("")),
    itemName: z.string().trim().min(1, "Nama produk/item wajib diisi.").max(180),
    checkoutMode: z.enum(["direct", "hosted", "embed"]).default("direct"),
  })
  .superRefine((data, ctx) => {
    if (data.method === "va" && data.amount < 10_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "Nominal minimum untuk Virtual Account adalah Rp 10.000.",
      });
    }
    if ((data.method === "qris" || data.method === "ewallet") && data.amount < 1_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "Nominal minimum untuk QRIS dan E-Wallet adalah Rp 1.000.",
      });
    }
    if ((data.method === "va" || data.method === "ewallet") && !data.bankCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bankCode"],
        message:
          data.method === "va"
            ? "Pilih bank Virtual Account terlebih dahulu."
            : "Pilih penyedia E-Wallet terlebih dahulu.",
      });
    }
  });

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get("status")?.trim().toLowerCase() || "";
    const query = searchParams.get("q")?.trim() || "";
    const shouldSync = searchParams.get("sync") === "true";

    let remoteSyncCount = 0;
    let remoteTotal = 0;
    let remoteSyncError: string | null = null;

    if (shouldSync) {
      try {
        const remote = await listRemotePayments();
        remoteTotal = remote.data.length;

        for (const item of remote.data) {
          if (!item.reference_id) continue;
          const existing = await db.query.payments.findFirst({
            where: eq(payments.referenceId, item.reference_id),
          });

          if (existing) {
            // Jangan pernah menurunkan status final "paid"
            const nextStatus =
              existing.status === "paid" ? "paid" : item.status || existing.status;

            if (nextStatus !== existing.status) {
              await db
                .update(payments)
                .set({
                  status: nextStatus,
                  paidAt:
                    nextStatus === "paid" && !existing.paidAt
                      ? item.paid_at
                        ? new Date(item.paid_at)
                        : new Date()
                      : existing.paidAt,
                  updatedAt: new Date(),
                })
                .where(eq(payments.id, existing.id));
              remoteSyncCount += 1;
            }
          }
        }
      } catch (err) {
        remoteSyncError =
          err instanceof BorderPayApiError
            ? err.message
            : "Gagal menyinkronkan daftar transaksi dari BorderPay.";
      }
    }

    const conditions = [];
    if (
      statusFilter &&
      ["pending", "paid", "expired", "failed"].includes(statusFilter)
    ) {
      conditions.push(eq(payments.status, statusFilter));
    }
    if (query) {
      const pattern = `%${query}%`;
      conditions.push(
        or(
          ilike(payments.referenceId, pattern),
          ilike(payments.customerName, pattern),
          ilike(payments.itemName, pattern)
        )
      );
    }

    const [rows, allRows] = await Promise.all([
      db
        .select()
        .from(payments)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(payments.createdAt))
        .limit(100),
      db.select().from(payments).orderBy(desc(payments.createdAt)),
    ]);

    const summary = allRows.reduce(
      (acc, row) => {
        acc.totalCount += 1;
        if (row.status === "paid") {
          acc.paidCount += 1;
          acc.paidVolume += row.customerPays;
          acc.netMerchantReceives += row.merchantReceives;
          acc.totalFees += row.fee;
        } else if (row.status === "pending") {
          acc.pendingCount += 1;
          acc.pendingVolume += row.customerPays;
        } else if (row.status === "expired") {
          acc.expiredCount += 1;
        } else {
          acc.failedCount += 1;
        }
        return acc;
      },
      {
        totalCount: 0,
        paidCount: 0,
        pendingCount: 0,
        expiredCount: 0,
        failedCount: 0,
        paidVolume: 0,
        pendingVolume: 0,
        netMerchantReceives: 0,
        totalFees: 0,
      }
    );

    return NextResponse.json({
      payments: rows,
      summary,
      sync: shouldSync
        ? {
            updatedCount: remoteSyncCount,
            remoteTotal,
            error: remoteSyncError,
          }
        : undefined,
    });
  } catch (error) {
    console.error("GET /api/payments error:", error);
    return NextResponse.json(
      {
        error: "database_error",
        message: "Gagal memuat riwayat pesanan.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createPaymentSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: "validation_error",
          message: firstIssue?.message || "Input pembayaran tidak valid.",
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    const data = parsed.data;
    const referenceId =
      data.referenceId && data.referenceId.length > 0
        ? data.referenceId
        : generateReferenceId("ORD");

    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") ||
      request.nextUrl.origin;
    const returnUrl = `${origin}/checkout/return?reference_id=${encodeURIComponent(referenceId)}`;

    const bpPayload = {
      amount: data.amount,
      method: data.method,
      ...(data.bankCode ? { bank_code: data.bankCode } : {}),
      reference_id: referenceId,
      return_url: returnUrl,
    };

    const bpRes = await createPayment(bpPayload);

    const resolvedReference = bpRes.reference_id || referenceId;
    const customerPays = Number(bpRes.customer_pays ?? bpRes.amount ?? data.amount);
    const fee = Number(bpRes.fee ?? 0);
    const merchantReceives = Number(
      bpRes.merchant_receives ?? Math.max(0, customerPays - fee)
    );

    const [inserted] = await db
      .insert(payments)
      .values({
        referenceId: resolvedReference,
        customerName: data.customerName,
        customerEmail: data.customerEmail || null,
        itemName: data.itemName,
        orderAmount: data.amount,
        customerPays,
        merchantReceives,
        fee,
        feeBorneBy: bpRes.fee_borne_by || "merchant",
        method: data.method,
        bankCode: data.bankCode || bpRes.va_bank || null,
        checkoutMode: data.checkoutMode,
        status: bpRes.status || "pending",
        mode: getBorderPayMode(),
        payUrl: bpRes.pay_url || null,
        returnUrl: bpRes.return_url || returnUrl,
        qrString: bpRes.qr_string || null,
        vaNumber: bpRes.va_number || null,
        vaBank: bpRes.va_bank || data.bankCode || null,
        checkoutUrl: bpRes.checkout_url || null,
        expiresAt: bpRes.expires_at ? new Date(bpRes.expires_at) : null,
        rawResponse: bpRes,
      })
      .returning();

    return NextResponse.json(
      {
        payment: inserted,
        requestPayload: bpPayload,
        borderpayResponse: bpRes,
      },
      { status: 201 }
    );
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

    const pgErr = error as { code?: string };
    if (pgErr?.code === "23505") {
      return NextResponse.json(
        {
          error: "duplicate_reference_id",
          message:
            "Reference ID tersebut sudah pernah digunakan. Gunakan Reference ID baru atau kosongkan agar dibuat otomatis.",
        },
        { status: 409 }
      );
    }

    console.error("POST /api/payments error:", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message: "Terjadi kesalahan saat membuat transaksi pembayaran.",
      },
      { status: 500 }
    );
  }
}
