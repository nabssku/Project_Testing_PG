"use client";

import { CopyButton } from "./CopyButton";

export function JsonInspector({
  title,
  badge,
  data,
  maxHeightClass = "max-h-80",
}: {
  title: string;
  badge?: string;
  data: unknown;
  maxHeightClass?: string;
}) {
  const formatted = JSON.stringify(data, null, 2);

  return (
    <div className="rounded-xl border border-[#E4E8EE] bg-[#0F172A] text-slate-100 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-slate-800 bg-slate-900/70">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-slate-200 truncate">
            {title}
          </span>
          {badge && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono-num font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {badge}
            </span>
          )}
        </div>
        <CopyButton
          value={formatted}
          label="Salin JSON"
          className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
        />
      </div>
      <pre
        className={`p-3.5 text-xs font-mono-num leading-relaxed overflow-auto whitespace-pre-wrap break-all text-slate-200 ${maxHeightClass}`}
      >
        <code>{formatted}</code>
      </pre>
    </div>
  );
}
