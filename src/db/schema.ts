import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    referenceId: varchar("reference_id", { length: 64 }).notNull().unique(),
    customerName: varchar("customer_name", { length: 120 }).notNull(),
    customerEmail: varchar("customer_email", { length: 160 }),
    itemName: varchar("item_name", { length: 180 }).notNull(),
    orderAmount: integer("order_amount").notNull(),
    customerPays: integer("customer_pays").notNull(),
    merchantReceives: integer("merchant_receives").notNull(),
    fee: integer("fee").notNull().default(0),
    feeBorneBy: varchar("fee_borne_by", { length: 20 })
      .notNull()
      .default("merchant"),
    method: varchar("method", { length: 20 }).notNull(), // qris | va | ewallet
    bankCode: varchar("bank_code", { length: 32 }),
    checkoutMode: varchar("checkout_mode", { length: 20 })
      .notNull()
      .default("direct"), // direct | hosted | embed
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | paid | expired | failed
    mode: varchar("mode", { length: 10 }).notNull().default("test"), // test | live
    payUrl: text("pay_url"),
    returnUrl: text("return_url"),
    qrString: text("qr_string"),
    vaNumber: varchar("va_number", { length: 64 }),
    vaBank: varchar("va_bank", { length: 32 }),
    checkoutUrl: text("checkout_url"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    rawResponse: jsonb("raw_response"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("payments_status_idx").on(table.status),
    index("payments_created_at_idx").on(table.createdAt),
  ]
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    event: varchar("event", { length: 64 }).notNull(),
    mode: varchar("mode", { length: 16 }).notNull().default("test"),
    referenceId: varchar("reference_id", { length: 64 }),
    tokenValid: boolean("token_valid").notNull().default(false),
    processed: boolean("processed").notNull().default(false),
    processingNote: text("processing_note"),
    headers: jsonb("headers"),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("webhook_events_reference_idx").on(table.referenceId),
    index("webhook_events_received_at_idx").on(table.receivedAt),
  ]
);

export const disbursements = pgTable(
  "disbursements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    referenceId: varchar("reference_id", { length: 64 }).notNull().unique(),
    amount: integer("amount").notNull(),
    fee: integer("fee").notNull().default(0),
    totalDeducted: integer("total_deducted").notNull().default(0),
    bankCode: varchar("bank_code", { length: 32 }).notNull(),
    accountNumberMasked: varchar("account_number_masked", { length: 32 }).notNull(),
    accountName: varchar("account_name", { length: 120 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    failReason: text("fail_reason"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    rawResponse: jsonb("raw_response"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("disbursements_created_at_idx").on(table.createdAt)]
);

export type PaymentRecord = typeof payments.$inferSelect;
export type NewPaymentRecord = typeof payments.$inferInsert;
export type WebhookEventRecord = typeof webhookEvents.$inferSelect;
export type DisbursementRecord = typeof disbursements.$inferSelect;
