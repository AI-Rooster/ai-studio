type OutputFile = {
  filename: string;
  subfolder?: string;
  type?: string;
};

type ImageGalleryRendererProps = {
  files: OutputFile[];
  outputRoute: string;
};

export default function ImageGalleryRenderer({
  files,
  outputRoute,
}: ImageGalleryRendererProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <h3 className="mb-4 text-xl font-semibold">Results</h3>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {files.map((item, index) => {
          const params = new URLSearchParams({
            filename: item.filename,
            subfolder: item.subfolder ?? "",
            type: item.type ?? "output",
          });

          return (
            <a
              key={`${item.filename}-${index}`}
              href={`${outputRoute}?${params.toString()}`}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-2xl border border-zinc-800 bg-black"
            >
              <img
                src={`${outputRoute}?${params.toString()}`}
                alt={item.filename}
                className="h-full w-full object-cover transition hover:scale-[1.01]"
              />
            </a>
          );
        })}
      </div>
    </div>
  );
}
