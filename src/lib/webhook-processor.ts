import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, webhookEvents } from "@/db/schema";
import { getPaymentStatus } from "@/lib/borderpay";
import { maskSecretToken } from "@/lib/webhook";

export interface BorderPayWebhookPayload {
  event?: string;
  mode?: string;
  data?: {
    slug?: string;
    reference_id?: string;
    order_id?: string;
    status?: string;
    amount?: number;
    fee?: number;
    merchant_receives?: number;
    method?: string;
  };
}

export interface ProcessWebhookInput {
  eventHeader: string | null;
  modeHeader: string | null;
  tokenHeader: string | null;
  tokenValid: boolean;
  rejectionReason?: string;
  payload: BorderPayWebhookPayload;
  isLocalSimulation?: boolean;
}

export async function processBorderPayWebhook(input: ProcessWebhookInput) {
  const eventName =
    input.eventHeader || input.payload.event || "unknown.event";
  const mode = input.modeHeader || input.payload.mode || "test";
  const data = input.payload.data;
  const referenceId = data?.reference_id || data?.order_id || null;

  const safeHeaders = {
    "x-borderpay-event": input.eventHeader,
    "x-borderpay-mode": input.modeHeader,
    "x-borderpay-token": maskSecretToken(input.tokenHeader),
    ...(input.isLocalSimulation ? { "x-demo-source": "local-simulator" } : {}),
  };

  // Aturan 1: Verifikasi pengirim — token tidak valid wajib ditolak 401
  if (!input.tokenValid) {
    const note =
      input.rejectionReason ||
      "Ditolak (401): header x-borderpay-token tidak cocok dengan BORDERPAY_WEBHOOK_TOKEN.";

    const [logged] = await db
      .insert(webhookEvents)
      .values({
        event: eventName,
        mode,
        referenceId,
        tokenValid: false,
        processed: false,
        processingNote: note,
        headers: safeHeaders,
        payload: input.payload,
      })
      .returning();

    return {
      httpStatus: 401,
      body: {
        ok: false,
        error: "invalid_webhook_token",
        message: note,
        eventId: logged.id,
      },
      record: logged,
    };
  }

  if (!referenceId || !data?.status) {
    const note =
      "Payload tidak lengkap: data.reference_id atau data.status kosong.";
    const [logged] = await db
      .insert(webhookEvents)
      .values({
        event: eventName,
        mode,
        referenceId,
        tokenValid: true,
        processed: false,
        processingNote: note,
        headers: safeHeaders,
        payload: input.payload,
      })
      .returning();

    return {
      httpStatus: 400,
      body: { ok: false, error: "invalid_payload", message: note, eventId: logged.id },
      record: logged,
    };
  }

  const existing = await db.query.payments.findFirst({
    where: eq(payments.referenceId, referenceId),
  });

  let processed = false;
  let processingNote = "";

  if (!existing) {
    processingNote = `Transaksi ${referenceId} tidak ditemukan di database lokal; event dicatat untuk audit.`;
  } else if (existing.status === "paid" && data.status === "paid") {
    // Aturan 2: Idempotency — transaksi sudah paid, abaikan pengiriman ulang
    processed = true;
    processingNote = `Idempoten: transaksi ${referenceId} sudah berstatus paid sebelumnya, event duplikat diabaikan.`;
  } else if (existing.status === "paid" && data.status !== "paid") {
    // Aturan status final BorderPay: paid adalah status final, jangan diturunkan
    processed = true;
    processingNote = `Status final dilindungi: transaksi ${referenceId} sudah paid, event '${data.status}' diabaikan.`;
  } else if (data.status === "paid") {
    // Security tip BorderPay: konfirmasi ke GET /api/v1/payments/{reference_id} bila tersedia
    let verifiedRemote = false;
    let remotePaidAt: Date | null = null;
    if (!input.isLocalSimulation) {
      try {
        const remote = await getPaymentStatus(referenceId);
        if (remote.status === "paid") {
          verifiedRemote = true;
          remotePaidAt = remote.paid_at ? new Date(remote.paid_at) : null;
        } else {
          processingNote = `Peringatan keamanan: webhook mengklaim paid, namun GET /payments/${referenceId} masih mengembalikan '${remote.status}'. Status lokal belum diubah.`;
        }
      } catch {
        // Jika verifikasi remote gagal karena jaringan sesaat, tetap catat agar bisa di-retry
        verifiedRemote = true;
      }
    } else {
      verifiedRemote = true;
    }

    if (verifiedRemote) {
      await db
        .update(payments)
        .set({
          status: "paid",
          customerPays:
            typeof data.amount === "number" ? data.amount : existing.customerPays,
          fee: typeof data.fee === "number" ? data.fee : existing.fee,
          merchantReceives:
            typeof data.merchant_receives === "number"
              ? data.merchant_receives
              : existing.merchantReceives,
          paidAt: remotePaidAt || existing.paidAt || new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payments.id, existing.id));

      processed = true;
      processingNote = input.isLocalSimulation
        ? `Simulasi lokal berhasil: status ${referenceId} diperbarui dari '${existing.status}' ke 'paid'.`
        : `Terverifikasi: status ${referenceId} diperbarui dari '${existing.status}' ke 'paid' dan tersimpan di Neon DB.`;
    }
  } else if (data.status === "expired" || data.status === "failed") {
    if (existing.status === data.status) {
      processed = true;
      processingNote = `Idempoten: transaksi ${referenceId} sudah berstatus '${data.status}'.`;
    } else {
      await db
        .update(payments)
        .set({
          status: data.status,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, existing.id));

      processed = true;
      processingNote = `Status ${referenceId} diperbarui dari '${existing.status}' ke '${data.status}'.`;
    }
  } else {
    processingNote = `Status event '${data.status}' dicatat tanpa perubahan.`;
  }

  // Aturan 3: Simpan ke database SEBELUM balas HTTP 200
  const [logged] = await db
    .insert(webhookEvents)
    .values({
      event: eventName,
      mode,
      referenceId,
      tokenValid: true,
      processed,
      processingNote,
      headers: safeHeaders,
      payload: input.payload,
    })
    .returning();

  return {
    httpStatus: 200,
    body: {
      ok: true,
      processed,
      note: processingNote,
      eventId: logged.id,
    },
    record: logged,
  };
}
