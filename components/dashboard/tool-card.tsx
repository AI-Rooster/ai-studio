import Link from "next/link";
import { ToolDefinition } from "@/lib/tools/types";
import StatusBadge from "@/components/workspace/status-badge";

type ToolCardProps = {
  tool: ToolDefinition;
};

export default function ToolCard({ tool }: ToolCardProps) {
  return (
    <Link
      href={`/tools/${tool.id}`}
      className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-700 hover:bg-zinc-900/80"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
            {tool.category.replace("-", " ")}
          </div>
          <h3 className="text-xl font-semibold text-white">{tool.title}</h3>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {tool.badge ? (
            <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200">
              {tool.badge}
            </span>
          ) : null}
          <StatusBadge status={tool.status} />
        </div>
      </div>

      <p className="mb-5 text-sm leading-6 text-zinc-400">
        {tool.shortDescription}
      </p>

      <div className="grid grid-cols-2 gap-3 text-sm text-zinc-300">
        <div className="rounded-xl border border-zinc-800 bg-black/40 p-3">
          <div className="mb-1 text-xs uppercase tracking-[0.15em] text-zinc-500">
            Input
          </div>
          <div>{tool.inputMode}</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-black/40 p-3">
          <div className="mb-1 text-xs uppercase tracking-[0.15em] text-zinc-500">
            Output
          </div>
          <div>{tool.outputMode}</div>
        </div>
      </div>

      <div className="mt-5 text-sm font-medium text-white/90 group-hover:text-white">
        Open tool {"->"}
      </div>
    </Link>
  );
}