type VideoRendererProps = {
  src?: string | null;
};

export default function VideoRenderer({ src }: VideoRendererProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h3 className="mb-3 text-xl font-semibold">Video output</h3>

      {src ? (
        <video
          src={src}
          controls
          className="w-full rounded-xl border border-zinc-800 bg-black"
        />
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-black/30 p-6 text-zinc-400">
          Video renderer scaffold is ready. Hook it up when the workflow and output
          parser are connected.
        </div>
      )}
    </div>
  );
}
