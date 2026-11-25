import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "NusaStore — Demo E-Commerce Payment Gateway BorderPay",
  description:
    "Demo toko online sederhana dengan pembayaran QRIS, Virtual Account, dan E-Wallet menggunakan BorderPay Payment Gateway.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${plusJakarta.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F7F8FA] text-[#0F172A]">
        <Script
          src="https://borderpay.id/embed.js"
          strategy="afterInteractive"
        />
        <Suspense
          fallback={<div className="h-16 border-b border-[#E4E8EE] bg-white" />}
        >
          <AppHeader />
        </Suspense>
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-7">
          {children}
        </main>
        <footer className="no-print border-t border-[#E4E8EE] bg-white/70 mt-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#526071]">
            <p>NusaStore · Demo Pembayaran Online dengan BorderPay</p>
            <span>Mode Sandbox · Simulasi tanpa uang sungguhan</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
