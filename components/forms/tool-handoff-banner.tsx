"use client";

import { ToolHandoffPayload } from "@/lib/tool-handoff";

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entryValue]) => `${key}: ${toText(entryValue)}`)
      .filter(Boolean)
      .join(" • ");
  }
  return String(value);
}

export default function ToolHandoffBanner({ handoff }: { handoff: ToolHandoffPayload }) {
  return (
    <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4">
      <div className="text-xs uppercase tracking-[0.15em] text-emerald-300">Campaign Studio handoff</div>
      <div className="mt-1 text-base font-medium text-white">{toText(handoff.taskTitle) || "Execution task"}</div>
      <div className="mt-1 text-sm text-emerald-100/80">
        {toText(handoff.campaignName)}
        {handoff.brandName || handoff.productName ? ` • ${[handoff.brandName, handoff.productName].filter(Boolean).join(" / ")}` : ""}
      </div>
      {handoff.purpose ? <div className="mt-3 text-sm text-zinc-200">{toText(handoff.purpose)}</div> : null}
      {handoff.prompt ? <div className="mt-3 rounded-lg border border-zinc-800 bg-black/40 p-3 text-sm leading-6 text-zinc-300">{toText(handoff.prompt)}</div> : null}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {handoff.outputFormat ? <div className="text-xs text-zinc-400">Output: <span className="text-zinc-200">{toText(handoff.outputFormat)}</span></div> : null}
        {handoff.requiredAssets?.length ? <div className="text-xs text-zinc-400">Assets: <span className="text-zinc-200">{handoff.requiredAssets.map(toText).join(", ")}</span></div> : null}
      </div>
      {handoff.notes ? <div className="mt-2 text-xs text-zinc-400">Notes: <span className="text-zinc-200">{toText(handoff.notes)}</span></div> : null}
    </div>
  );
}
