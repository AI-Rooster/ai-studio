import { ToolDefinition } from "@/lib/tools/types";

type TextPlusOptionsFormProps = {
  tool: ToolDefinition;
};

export default function TextPlusOptionsForm({ tool }: TextPlusOptionsFormProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-3 text-2xl font-semibold">Prompt builder</h2>
        <p className="mb-6 text-zinc-400">
          This scaffold is ready for tools that generate assets from text, brand style
          cues and optional creative parameters.
        </p>

        <div className="space-y-4">
          <textarea
            disabled
            rows={7}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-500"
            placeholder={`Prompt for ${tool.title}`}
          />

          <input
            disabled
            type="text"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-500"
            placeholder="Brand style / color / mood"
          />
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
          Result gallery / asset pack renderer will appear here after the workflow is connected.
        </div>
      </section>
    </div>
  );
}
