# BorderPay Sandbox Studio — Demo Payment Gateway

Aplikasi demo Payment Gateway berbasis **Next.js 16 (App Router, TypeScript, Tailwind CSS)** yang terintegrasi dengan **BorderPay API v1** (`https://borderpay.id/api/v1`) dan **Neon PostgreSQL** (Drizzle ORM).

## Fitur Utama

- **Toko & Checkout (`/`)**: Katalog produk e-commerce dengan keranjang belanja, metode pembayaran dinamis (`GET /api/v1/payment-methods`) untuk QRIS, Virtual Account, dan E-Wallet.
- **Instruksi Pembayaran (`/pay/[referenceId]`)**: Menampilkan QR Code QRIS (beserta unduh PNG), nomor Virtual Account, atau tautan E-Wallet, hitung mundur batas bayar, tombol simulasi bayar lunas, pembatalan pesanan, dan struk siap cetak.
- **Return URL Handler (`/checkout/return`)**: Verifikasi otomatis status pembayaran pasca-redirect dari halaman pembayaran BorderPay.
- **Riwayat Pesanan (`/transactions`)**: Ringkasan pesanan, pencarian/filter status, serta aksi cepat (Bayar simulasi, Perbarui Status, Batalkan).
- **Webhook Backend Receiver**: Endpoint privat `POST /api/webhooks/borderpay` dengan verifikasi token konstan-waktu (`x-borderpay-token`), idempotency, dan proteksi status final `paid`.

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
