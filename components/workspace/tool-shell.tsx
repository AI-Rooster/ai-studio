import { ReactNode } from "react";
import { ToolDefinition } from "@/lib/tools/types";

type ToolShellProps = {
  tool: ToolDefinition;
  children: ReactNode;
};

function formatCategoryLabel(category: string) {
  return category
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function ToolShell({ tool, children }: ToolShellProps) {
  const acceptsText =
    Array.isArray(tool.accepts) && tool.accepts.length > 0
      ? tool.accepts.join(", ")
      : "text / options";

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs uppercase tracking-[0.18em] text-zinc-300">
              {formatCategoryLabel(tool.category)}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${
                tool.status === "active"
                  ? "border border-emerald-700 bg-emerald-950/50 text-emerald-200"
                  : tool.status === "beta"
                  ? "border border-amber-700 bg-amber-950/50 text-amber-200"
                  : "border border-zinc-700 bg-zinc-950 text-zinc-300"
              }`}
            >
              {tool.status}
            </span>

            {tool.badge ? (
              <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-200">
                {tool.badge}
              </span>
            ) : null}

            {tool.creditMode === "premium" ? (
              <span className="rounded-full border border-fuchsia-700 bg-fuchsia-950/40 px-3 py-1 text-xs text-fuchsia-200">
                Premium credits
              </span>
            ) : null}
          </div>

          <h1 className="mb-2 text-3xl font-semibold">{tool.title}</h1>
          <p className="max-w-3xl text-zinc-400">{tool.shortDescription}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="mb-1 text-xs uppercase tracking-[0.15em] text-zinc-500">
                Input
              </div>
              <div className="text-sm text-zinc-200">{tool.inputMode}</div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="mb-1 text-xs uppercase tracking-[0.15em] text-zinc-500">
                Output
              </div>
              <div className="text-sm text-zinc-200">{tool.outputMode}</div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="mb-1 text-xs uppercase tracking-[0.15em] text-zinc-500">
                Accepts
              </div>
              <div className="text-sm text-zinc-200 break-words">{acceptsText}</div>
            </div>
          </div>

          {tool.creditMode === "premium" && tool.creditCostNote ? (
            <div className="mt-5 rounded-xl border border-fuchsia-900 bg-fuchsia-950/20 p-4 text-sm text-fuchsia-200">
              {tool.creditCostNote}
            </div>
          ) : null}
        </div>

        {children}
      </div>
    </main>
  );
}
