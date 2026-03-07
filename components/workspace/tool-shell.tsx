import Link from "next/link";
import { ToolDefinition } from "@/lib/tools/types";
import StatusBadge from "@/components/workspace/status-badge";

type ToolShellProps = {
  tool: ToolDefinition;
  children: React.ReactNode;
};

export default function ToolShell({ tool, children }: ToolShellProps) {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
          <Link href="/tools" className="hover:text-white">
            Tools
          </Link>
          <span>/</span>
          <span className="text-zinc-200">{tool.title}</span>
        </div>

        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 md:p-8">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                {tool.category.replace("-", " ")}
              </div>
              <h1 className="mb-3 text-4xl font-bold">{tool.title}</h1>
              <p className="text-zinc-400">{tool.longDescription}</p>
            </div>

            <div className="flex items-center gap-2">
              {tool.badge ? (
                <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-200">
                  {tool.badge}
                </span>
              ) : null}
              <StatusBadge status={tool.status} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
              <div className="mb-1 text-xs uppercase tracking-[0.15em] text-zinc-500">
                Input mode
              </div>
              <div className="text-zinc-200">{tool.inputMode}</div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
              <div className="mb-1 text-xs uppercase tracking-[0.15em] text-zinc-500">
                Output mode
              </div>
              <div className="text-zinc-200">{tool.outputMode}</div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
              <div className="mb-1 text-xs uppercase tracking-[0.15em] text-zinc-500">
                Files
              </div>
              <div className="text-zinc-200">
                {tool.minFiles} - {tool.maxFiles}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
              <div className="mb-1 text-xs uppercase tracking-[0.15em] text-zinc-500">
                Accepts
              </div>
              <div className="break-words text-zinc-200">
                {tool.accepts.length > 0 ? tool.accepts.join(", ") : "text / options"}
              </div>
            </div>
          </div>

          {tool.creditCostNote ? (
            <div className="mt-4 rounded-2xl border border-amber-900/60 bg-amber-950/30 p-4 text-sm text-amber-200">
              <strong className="mr-2">Credit note:</strong>
              {tool.creditCostNote}
            </div>
          ) : null}
        </div>

        {children}
      </div>
    </main>
  );
}
