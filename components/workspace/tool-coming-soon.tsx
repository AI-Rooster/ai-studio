import { ToolDefinition } from "@/lib/tools/types";

type ToolComingSoonProps = {
  tool: ToolDefinition;
};

export default function ToolComingSoon({ tool }: ToolComingSoonProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-4 text-2xl font-semibold">Tool preview</h2>
        <p className="mb-6 text-zinc-400">
          Ten tool jest już wpisany w katalog i gotowy pod właściwe podpięcie workflowu,
          ale backend dla niego nie został jeszcze wdrożony.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
            <div className="mb-1 text-xs uppercase tracking-[0.15em] text-zinc-500">
              Planned input
            </div>
            <div>{tool.inputMode}</div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
            <div className="mb-1 text-xs uppercase tracking-[0.15em] text-zinc-500">
              Planned output
            </div>
            <div>{tool.outputMode}</div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-4 text-2xl font-semibold">What still needs wiring</h2>
        <ul className="space-y-3 text-sm leading-6 text-zinc-400">
          <li>- workflow JSON for this tool</li>
          <li>- input mapper for nodes / prompt / uploads</li>
          <li>- generate endpoint</li>
          <li>- output parser / result renderer</li>
          <li>- optional history + pricing rules</li>
        </ul>
      </div>
    </div>
  );
}
