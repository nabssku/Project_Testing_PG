# BorderPay Sandbox Studio — Demo Payment Gateway

Aplikasi demo Payment Gateway berbasis **Next.js 16 (App Router, TypeScript, Tailwind CSS)** yang terintegrasi dengan **BorderPay API v1** (`https://borderpay.id/api/v1`) dan **Neon PostgreSQL** (Drizzle ORM).

## Fitur Utama

- **Checkout Demo (`/`)**: Memilih produk katalog atau nominal kustom, memuat metode pembayaran aktif beserta skema biaya (`percent`, `flat`, `tiers`) secara dinamis dari `GET /api/v1/payment-methods`, mendukung **3 mode integrasi** (*Direct Custom UI*, *Hosted Checkout `pay_url`*, dan *Embed Popup `embed.js`*), serta *Live API Request Payload Preview*.
- **Instruksi Pembayaran & Simulasi (`/pay/[referenceId]`)**: Menampilkan QR Code QRIS (`qr_string` dengan opsi unduh PNG), nomor Virtual Account (`va_number` + `va_bank`), atau tautan E-Wallet (`checkout_url`), hitung mundur `expires_at`, auto-sync status, tombol **Simulasikan Bayar Lunas (Test Mode)**, pembatalan transaksi, serta struk digital siap cetak saat status `paid`.
- **Return URL Handler (`/checkout/return`)**: Verifikasi otomatis status pembayaran pasca-redirect dari Hosted Checkout BorderPay.
- **Dashboard Transaksi & Saldo (`/transactions`)**: Menampilkan saldo live merchant (`GET /api/v1/balance`), ringkasan volume dari Neon PostgreSQL, pencarian/filter status, aksi cepat (Simulasi, Cek Status, Batalkan, Inspeksi JSON), dan sinkronisasi dari `GET /api/v1/payments`.
- **Webhook Receiver & Inspector (`/webhooks`)**: Endpoint `POST /api/webhooks/borderpay` dengan verifikasi token konstan-waktu (`x-borderpay-token`), idempotency, proteksi status final `paid`, penyimpanan audit di Neon DB sebelum respons `200 OK`, serta simulator webhook lokal.
- **Disbursements Playground (`/disbursements`)**: Formulir uji `POST /api/v1/disbursements` dan riwayat `GET /api/v1/disbursements`.

## Menjalankan Proyek Secara Lokal

1. Pastikan konfigurasi environment tersedia di `.env.local` (lihat `.env.example`):
   ```env
   DATABASE_URL="postgresql://..."
   BORDERPAY_API_KEY="bp_test_..."
   BORDERPAY_BASE_URL="https://borderpay.id/api/v1"
   BORDERPAY_WEBHOOK_TOKEN=""
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```
2. Dorong skema database ke Neon PostgreSQL:
   ```bash
   npm run db:push
   ```
3. Jalankan server pengembangan:
   ```bash
   npm run dev
   ```
4. Buka [http://localhost:3000](http://localhost:3000) di browser Anda.

## Menautkan Webhook Publik BorderPay

1. Ekspos aplikasi ke URL publik (misalnya deploy ke Vercel atau menggunakan tunnel seperti ngrok/Cloudflare Tunnel).
2. Daftarkan `https://<domain-anda>/api/webhooks/borderpay` di dashboard BorderPay.
3. Salin *verification token* (`bpt_...`) dari dashboard BorderPay ke `BORDERPAY_WEBHOOK_TOKEN` di `.env.local`, lalu muat ulang server.
