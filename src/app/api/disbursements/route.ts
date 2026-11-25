import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { disbursements } from "@/db/schema";
import {
  BorderPayApiError,
  createDisbursement,
  listDisbursements,
} from "@/lib/borderpay";
import { generateReferenceId } from "@/lib/format";

const createDisbursementSchema = z.object({
  amount: z.coerce
    .number()
    .int("Nominal harus bilangan bulat Rupiah.")
    .min(10_000, "Nominal minimum disbursement adalah Rp 10.000."),
  bankCode: z
    .string()
    .trim()
    .min(2, "Kode bank wajib dipilih.")
    .max(32)
    .transform((v) => v.toUpperCase()),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{6,20}$/, "Nomor rekening harus berupa 6 hingga 20 digit angka."),
  accountName: z
    .string()
    .trim()
    .min(2, "Nama pemilik rekening wajib diisi.")
    .max(120),
  referenceId: z
    .string()
    .trim()
    .max(64)
    .regex(
      /^[a-zA-Z0-9._-]*$/,
      "Reference ID hanya boleh berisi huruf, angka, titik, strip, dan garis bawah."
    )
    .optional(),
});

export async function GET() {
  let remoteDisbursements: unknown[] = [];
  let remoteError: { code: string; message: string; status: number } | null =
    null;

  try {
    const remote = await listDisbursements();
    remoteDisbursements = remote;

    for (const item of remote) {
      if (!item.reference_id) continue;
      const existing = await db.query.disbursements.findFirst({
        where: eq(disbursements.referenceId, item.reference_id),
      });

      if (existing) {
        await db
          .update(disbursements)
          .set({
            status: item.status || existing.status,
            totalDeducted: Number(item.total_deducted ?? existing.totalDeducted),
            failReason: item.fail_reason ?? existing.failReason,
            processedAt: item.processed_at
              ? new Date(item.processed_at)
              : existing.processedAt,
            rawResponse: item,
          })
          .where(eq(disbursements.id, existing.id));
      }
    }
  } catch (error) {
    if (error instanceof BorderPayApiError) {
      remoteError = {
        code: error.code,
        message: error.message,
        status: error.status,
      };
    } else {
      remoteError = {
        code: "network_error",
        message: "Gagal mengambil daftar disbursements dari BorderPay.",
        status: 502,
      };
    }
  }

  try {
    const localRows = await db
      .select()
      .from(disbursements)
      .orderBy(desc(disbursements.createdAt))
      .limit(50);

    return NextResponse.json({
      disbursements: localRows,
      remoteDisbursements,
      remoteError,
    });
  } catch (error) {
    console.error("GET /api/disbursements error:", error);
    return NextResponse.json(
      { error: "database_error", message: "Gagal memuat data disbursements." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createDisbursementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: parsed.error.issues[0]?.message || "Input payout tidak valid.",
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    const data = parsed.data;
    const referenceId =
      data.referenceId && data.referenceId.length > 0
        ? data.referenceId
        : generateReferenceId("PO");

    const bpPayload = {
      amount: data.amount,
      bank_code: data.bankCode,
      account_number: data.accountNumber,
      account_name: data.accountName,
      reference_id: referenceId,
    };

    const bpRes = await createDisbursement(bpPayload);

    const maskedAcct =
      bpRes.account_number ||
      `${"•".repeat(Math.max(0, data.accountNumber.length - 4))}${data.accountNumber.slice(-4)}`;

    const [inserted] = await db
      .insert(disbursements)
      .values({
        referenceId: bpRes.reference_id || referenceId,
        amount: Number(bpRes.amount ?? data.amount),
        fee: Number(bpRes.fee ?? 0),
        totalDeducted: Number(bpRes.total_deducted ?? data.amount),
        bankCode: bpRes.bank_code || data.bankCode,
        accountNumberMasked: maskedAcct,
        accountName: data.accountName,
        status: bpRes.status || "pending",
        failReason: bpRes.fail_reason || null,
        processedAt: bpRes.processed_at ? new Date(bpRes.processed_at) : null,
        rawResponse: bpRes,
      })
      .onConflictDoUpdate({
        target: disbursements.referenceId,
        set: {
          status: bpRes.status || "pending",
          fee: Number(bpRes.fee ?? 0),
          totalDeducted: Number(bpRes.total_deducted ?? data.amount),
          rawResponse: bpRes,
        },
      })
      .returning();

    return NextResponse.json(
      {
        disbursement: inserted,
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
    console.error("POST /api/disbursements error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Gagal memproses disbursement." },
      { status: 500 }
    );
  }
}
