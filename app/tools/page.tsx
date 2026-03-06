import ToolGrid from "@/components/dashboard/tool-grid";

export default function ToolsPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-3xl">
          <div className="mb-3 text-xs uppercase tracking-[0.25em] text-zinc-500">
            AI Creative Studio
          </div>
          <h1 className="mb-4 text-5xl font-bold">Tools for marketers</h1>
          <p className="text-lg text-zinc-400">
            A growing toolkit for product visuals, motion, campaign assets and avatar
            content. Start with the tools that are already wired and keep expanding from
            the same system.
          </p>
        </div>

        <ToolGrid />
      </div>
    </main>
  );
}
