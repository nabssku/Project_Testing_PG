"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ReceiptText,
  ShoppingBag,
  Store,
} from "lucide-react";
import { cn } from "@/lib/format";

const NAV_ITEMS = [
  { href: "/", label: "Belanja", icon: Store },
  { href: "/transactions", label: "Pesanan", icon: ReceiptText },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-[#E4E8EE] bg-white/95 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-7 min-w-0">
            <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
              <div className="h-9 w-9 rounded-xl bg-[#1D4ED8] text-white flex items-center justify-center shadow-xs group-hover:bg-[#1E40AF] transition-colors">
                <ShoppingBag className="h-4.5 w-4.5" />
              </div>
              <div className="leading-tight">
                <div className="font-bold text-base tracking-tight text-[#0F172A]">
                  NusaStore
                </div>
                <div className="text-[11px] font-medium text-[#526071]">
                  Powered by BorderPay
                </div>
              </div>
            </Link>

            <nav
              aria-label="Navigasi utama"
              className="hidden md:flex items-center gap-1"
            >
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/" || pathname.startsWith("/pay/")
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-blue-50 text-[#1D4ED8]"
                        : "text-[#526071] hover:text-[#0F172A] hover:bg-slate-100/80"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span>Mode Demo</span>
            </span>
          </div>
        </div>

        {/* Navigasi mobile */}
        <nav
          aria-label="Navigasi mobile"
          className="flex md:hidden items-center gap-1 pb-2.5 overflow-x-auto"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/" || pathname.startsWith("/pay/")
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-blue-50 text-[#1D4ED8]"
                    : "text-[#526071] hover:bg-slate-100"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
