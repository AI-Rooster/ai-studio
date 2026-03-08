"use client";

import { useMemo, useState } from "react";

type FormProps = {
  toolId?: string;
  title?: string;
  description?: string;
};

type ErrorResponse = {
  ok: false;
  error: string;
};

type GenerateResponse =
  | {
      ok: true;
      promptId: string;
      uploadedFile: string;
      workflowPath: string;
      premium?: boolean;
      extraCredits?: boolean;
    }
  | ErrorResponse;

type JobStatusValue =
  | "waiting_to_dispatch"
  | "pending"
  | "in_progress"
  | "completed"
  | "success"
  | "failed"
  | "error"
  | "cancelled";

type JobStatusResponse =
  | {
      ok: true;
      id?: string | null;
      status: JobStatusValue;
      raw?: unknown;
    }
  | ErrorResponse;

type OutputFile = {
  filename: string;
  subfolder?: string;
  type?: string;
};

type JobDetails = {
  id: string;
  status: string;
  outputs?: Record<string, unknown>;
  preview_output?: unknown;
  execution_error?: unknown;
};

type JobDetailsResponse =
  | {
      ok: true;
      job: JobDetails;
    }
  | ErrorResponse;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFirstImageFile(value: unknown): OutputFile | null {
  if (!value || typeof value !== "object") return null;
  const node = value as Record<string, unknown>;
  const images = node.images;
  if (!Array.isArray(images) || !images.length) return null;
  const first = images[0];
  if (!first || typeof first !== "object") return null;
  const file = first as Record<string, unknown>;
  if (typeof file.filename !== "string") return null;

  return {
    filename: file.filename,
    subfolder: typeof file.subfolder === "string" ? file.subfolder : "",
    type: typeof file.type === "string" ? file.type : "output",
  };
}

function buildOutputUrl(file: OutputFile) {
  const params = new URLSearchParams({
    filename: file.filename,
    subfolder: file.subfolder ?? "",
    type: file.type ?? "output",
  });

  return `/api/output?${params.toString()}`;
}

export default function ProductGridForm({
  toolId = "product-grid",
  title = "Product Grid",
  description = "1 product image -> stitched 3x3 ad grid + 9 cropped tiles + 1 upscaled selected tile.",
}: FormProps) {
  const [productImage, setProductImage] = useState<File | null>(null);
  const [masterPrompt, setMasterPrompt] = useState(
    "Create an editorial photoreal 3×3 grid for a high end e commerce ad featuring only the uploaded product. Background: minimalist studio. Lighting: soft and diffused. Generate as one 3×3 grid with no margin, gutter or borders."
  );
  const [gridSeed, setGridSeed] = useState(54320);
  const [gridAspectRatio, setGridAspectRatio] = useState("auto");
  const [gridResolution, setGridResolution] = useState("2K");
  const [cropInset, setCropInset] = useState(0);
  const [selectedImageNumber, setSelectedImageNumber] = useState(1);
  const [upscalePrompt, setUpscalePrompt] = useState(
    "Upscale image 1. Use the product from image 2 as a reference."
  );
  const [upscaleSeed, setUpscaleSeed] = useState(54321);
  const [upscaleAspectRatio, setUpscaleAspectRatio] = useState("auto");
  const [upscaleResolution, setUpscaleResolution] = useState("4K");

  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [promptId, setPromptId] = useState("");
  const [status, setStatus] = useState("");
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);

  const stitchedImage = useMemo(() => {
    return getFirstImageFile(jobDetails?.outputs?.["68"]);
  }, [jobDetails]);

  const upscaledImage = useMemo(() => {
    return getFirstImageFile(jobDetails?.outputs?.["81"]);
  }, [jobDetails]);

  const tileImages = useMemo(() => {
    const orderedNodeIds = ["59", "60", "61", "62", "64", "63", "65", "66", "67"];
    return orderedNodeIds
      .map((nodeId) => getFirstImageFile(jobDetails?.outputs?.[nodeId]))
      .filter(Boolean) as OutputFile[];
  }, [jobDetails]);

  async function fetchJobDetails(currentPromptId: string) {
    const response = await fetch(`/api/job-details/${currentPromptId}`, {
      cache: "no-store",
    });

    const data = (await response.json()) as JobDetailsResponse;

    if (!response.ok || !data.ok) {
      throw new Error("Nie udało się pobrać szczegółów joba.");
    }

    return data.job;
  }

  async function pollUntilFinished(currentPromptId: string) {
    const maxAttempts = 180;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(`/api/job-status/${currentPromptId}`, {
        cache: "no-store",
      });

      const data = (await response.json()) as JobStatusResponse;

      if (!response.ok || !data.ok) {
        throw new Error("Nie udało się sprawdzić statusu joba.");
      }

      const currentStatus = data.status;
      setStatus(currentStatus);

      if (currentStatus === "completed" || currentStatus === "success") {
        const details = await fetchJobDetails(currentPromptId);
        setJobDetails(details);
        setStatus("completed");
        return;
      }

      if (currentStatus === "failed" || currentStatus === "error") {
        const details = await fetchJobDetails(currentPromptId).catch(() => null);
        if (details) setJobDetails(details);
        throw new Error("Job zakończył się błędem.");
      }

      if (currentStatus === "cancelled") {
        throw new Error("Job został anulowany.");
      }

      await sleep(3000);
    }

    throw new Error("Przekroczono czas oczekiwania na wynik.");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPromptId("");
    setStatus("");
    setJobDetails(null);

    if (!productImage) {
      setError("Najpierw wybierz obraz produktu.");
      return;
    }

    try {
      setIsSending(true);

      const formData = new FormData();
      formData.append("productImage", productImage);
      formData.append("masterPrompt", masterPrompt);
      formData.append("gridSeed", String(gridSeed));
      formData.append("gridAspectRatio", gridAspectRatio);
      formData.append("gridResolution", gridResolution);
      formData.append("cropInset", String(cropInset));
      formData.append("selectedImageNumber", String(selectedImageNumber));
      formData.append("upscalePrompt", upscalePrompt);
      formData.append("upscaleSeed", String(upscaleSeed));
      formData.append("upscaleAspectRatio", upscaleAspectRatio);
      formData.append("upscaleResolution", upscaleResolution);

      const response = await fetch(`/api/tools/${toolId}/generate`, {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as GenerateResponse;

      if (!response.ok || !data.ok) {
        throw new Error("error" in data ? data.error : "Nie udało się wysłać joba.");
      }

      setPromptId(data.promptId);
      setStatus("pending");

      await pollUntilFinished(data.promptId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-4 rounded-xl border border-amber-900/40 bg-amber-950/30 p-4 text-sm text-amber-200">
        Premium tool: ten workflow używa Nano Banana / Gemini i powinien kosztować użytkownika extra credits.
      </div>

      <h2 className="mb-3 text-2xl font-semibold text-white">{title}</h2>
      <p className="mb-6 text-zinc-400">{description}</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Product image
          </label>

          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setProductImage(file);
            }}
            className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Master prompt
          </label>
          <textarea
            value={masterPrompt}
            onChange={(e) => setMasterPrompt(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Grid seed
            </label>
            <input
              type="number"
              value={gridSeed}
              onChange={(e) => setGridSeed(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Grid aspect ratio
            </label>
            <input
              type="text"
              value={gridAspectRatio}
              onChange={(e) => setGridAspectRatio(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
              placeholder="auto"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Grid resolution
            </label>
            <input
              type="text"
              value={gridResolution}
              onChange={(e) => setGridResolution(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
              placeholder="2K"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Crop inset
            </label>
            <input
              type="number"
              value={cropInset}
              onChange={(e) => setCropInset(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Selected tile (1-9)
            </label>
            <input
              type="number"
              min={1}
              max={9}
              value={selectedImageNumber}
              onChange={(e) => setSelectedImageNumber(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Upscale prompt
            </label>
            <textarea
              value={upscalePrompt}
              onChange={(e) => setUpscalePrompt(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
          </div>

          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Upscale seed
              </label>
              <input
                type="number"
                value={upscaleSeed}
                onChange={(e) => setUpscaleSeed(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Upscale aspect ratio
              </label>
              <input
                type="text"
                value={upscaleAspectRatio}
                onChange={(e) => setUpscaleAspectRatio(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
                placeholder="auto"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Upscale resolution
              </label>
              <input
                type="text"
                value={upscaleResolution}
                onChange={(e) => setUpscaleResolution(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
                placeholder="4K"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSending}
          className="rounded-lg bg-white px-5 py-3 font-medium text-black disabled:opacity-50"
        >
          {isSending ? "Przetwarzanie..." : "Generate product grid"}
        </button>
      </form>

      {promptId ? (
        <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-zinc-200">
          <div>
            <strong>promptId:</strong> {promptId}
          </div>
          <div>
            <strong>status:</strong> {status || "—"}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-200">
          {error}
        </div>
      ) : null}

      {stitchedImage ? (
        <div className="mt-8">
          <h3 className="mb-4 text-xl font-semibold text-white">Stitched grid</h3>
          <img
            src={buildOutputUrl(stitchedImage)}
            alt="Stitched product grid"
            className="w-full rounded-xl border border-zinc-800 bg-black"
          />
        </div>
      ) : null}

      {upscaledImage ? (
        <div className="mt-8">
          <h3 className="mb-4 text-xl font-semibold text-white">Upscaled selected tile</h3>
          <img
            src={buildOutputUrl(upscaledImage)}
            alt="Upscaled selected tile"
            className="w-full rounded-xl border border-zinc-800 bg-black"
          />
        </div>
      ) : null}

      {tileImages.length > 0 ? (
        <div className="mt-8">
          <h3 className="mb-4 text-xl font-semibold text-white">Individual tiles</h3>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tileImages.map((item, index) => (
              <img
                key={`${item.filename}-${index}`}
                src={buildOutputUrl(item)}
                alt={`Tile ${index + 1}`}
                className="w-full rounded-xl border border-zinc-800 bg-black"
              />
            ))}
          </div>
        </div>
      ) : null}

      {jobDetails ? (
        <details className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <summary className="cursor-pointer text-zinc-200">
            Pokaż surowe dane joba
          </summary>
          <pre className="mt-4 overflow-auto text-xs text-zinc-400">
            {JSON.stringify(jobDetails, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
