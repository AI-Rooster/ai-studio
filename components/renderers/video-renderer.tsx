type VideoRendererProps = {
  src?: string | null;
  href?: string | null;
};

export default function VideoRenderer({ src, href }: VideoRendererProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h3 className="mb-3 text-xl font-semibold">Video output</h3>

      {src ? (
        <div className="space-y-4">
          <video
            src={src}
            controls
            playsInline
            className="w-full rounded-xl border border-zinc-800 bg-black"
          />
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-600 hover:text-white"
            >
              Open raw file
            </a>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-black/30 p-6 text-zinc-400">
          Video renderer is ready. The final clip will appear here after the workflow completes.
        </div>
      )}
    </div>
  );
}
