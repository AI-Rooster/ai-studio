import { ToolDefinition } from "@/lib/tools/types";

type MultiImageSequenceFormProps = {
  tool: ToolDefinition;
};

export default function MultiImageSequenceForm({
  tool,
}: MultiImageSequenceFormProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-3 text-2xl font-semibold">Sequence input</h2>
        <p className="mb-6 text-zinc-400">
          This tool will use an ordered image sequence. On the next step we can wire
          exact upload order, preview tiles and drag-to-reorder.
        </p>

        <div className="space-y-3">
          {Array.from({ length: tool.maxFiles }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-zinc-800 bg-black/30 p-4 text-zinc-300"
            >
              Frame {index + 1}
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled
          className="mt-6 rounded-xl bg-white/20 px-5 py-3 font-medium text-white opacity-60"
        >
          Generate (not wired yet)
        </button>
      </section>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-3 text-2xl font-semibold">Output</h2>
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-black/30 p-8 text-zinc-500">
          Video renderer will appear here after the workflow is connected.
        </div>
      </section>
    </div>
  );
}
