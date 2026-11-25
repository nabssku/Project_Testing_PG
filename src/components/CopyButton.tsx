"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/format";

export function CopyButton({
  value,
  label = "Salin",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-[#E4E8EE] bg-white text-[#0F172A] hover:bg-slate-50 transition-colors cursor-pointer",
        className
      )}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-teal-700">Tersalin</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 text-[#526071]" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
