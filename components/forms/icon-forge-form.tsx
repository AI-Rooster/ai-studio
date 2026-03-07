"use client";

import { useMemo, useState } from "react";
import { ToolDefinition } from "@/lib/tools/types";

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
      premiumTool: boolean;
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

type IconForgeFormProps = {
  tool: ToolDefinition;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function collectOutputFiles(value: unknown, bucket: OutputFile[] = []): OutputFile[] {
  if (value == null) return bucket;

  if (Array.isArray(value)) {
    for (const item of value) {
      collectOutputFiles(item, bucket);
    }
    return bucket;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;

    if (typeof obj.filename === "string") {
      bucket.push({
        filename: obj.filename,
        subfolder: typeof obj.subfolder === "string" ? obj.subfolder : "",
        type: typeof obj.type === "string" ? obj.type : "output",
      });
    }

    for (const nested of Object.values(obj)) {
      collectOutputFiles(nested, bucket);
    }
  }

  return bucket;
}

function uniqOutputFiles(files: OutputFile[]) {
  const map = new Map<string, OutputFile>();

  for (const file of files) {
    const key = `${file.type ?? "output"}::${file.subfolder ?? ""}::${file.filename}`;
    if (!map.has(key)) {
      map.set(key, file);
    }
  }

  return Array.from(map.values());
}

export default function IconForgeForm({ tool }: IconForgeFormProps) {
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [brandDescription, setBrandDescription] = useState(
    "A company building the operating system for Generative AI."
  );
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [seed, setSeed] = useState("12345");
  const [resolution, setResolution] = useState("4K");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [filenamePrefixBase, setFilenamePrefixBase] = useState("ComfyUI");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [promptId, setPromptId] = useState("");
  const [status, setStatus] = useState("");
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);

  const outputFiles = useMemo(() => {
    if (!jobDetails?.outputs) return [];

    return uniqOutputFiles(collectOutputFiles(jobDetails.outputs)).filter(
      (item) => (item.type ?? "output") === "output"
    );
  }, [jobDetails]);

  const gridFile = useMemo(() => {
    return outputFiles.find((item) => item.filename.toLowerCase().includes("grid")) ?? outputFiles[0] ?? null;
  }, [outputFiles]);

  const iconFiles = useMemo(() => {
    return outputFiles.filter((item) => item !== gridFile);
  }, [outputFiles, gridFile]);

  async function fetchJobDetails(currentPromptId: string) {
    const response = await fetch(`${tool.detailsRouteBase}/${currentPromptId}`, {
      cache: "no-store",
    });

    const data = (await response.json()) as JobDetailsResponse;

    if (!response.ok || !data.ok) {
      throw new Error("Nie udało się pobrać szczegółów joba.");
    }

    return data.job;
  }

  async function pollUntilFinished(currentPromptId: string) {
    const maxAttempts = 120;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(`${tool.statusRouteBase}/${currentPromptId}`, {
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
        if (details) {
          setJobDetails(details);
        }
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

    if (!referenceImage) {
      setError("Najpierw wybierz obraz referencyjny.");
      return;
    }

    try {
      setIsSending(true);

      const formData = new FormData();
      formData.append("referenceImage", referenceImage);
      formData.append("brandDescription", brandDescription);
      formData.append("additionalInstructions", additionalInstructions);
      formData.append("seed", seed);
      formData.append("resolution", resolution);
      formData.append("aspectRatio", aspectRatio);
      formData.append("filenamePrefixBase", filenamePrefixBase);

      const response = await fetch(tool.generateRoute!, {
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
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-3 text-2xl font-semibold">Icon Forge</h2>
        <p className="mb-4 text-zinc-400">
          Upload one style reference, describe the brand context and generate a consistent 3x3 icon pack.
        </p>

        {tool.creditCostNote ? (
          <div className="mb-6 rounded-2xl border border-amber-900/60 bg-amber-950/30 p-4 text-sm text-amber-200">
            <strong className="mr-2">Extra credits:</strong>
            {tool.creditCostNote}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Reference icon style image
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setReferenceImage(e.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Brand / product context
            </label>
            <textarea
              value={brandDescription}
              onChange={(e) => setBrandDescription(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
              placeholder="Describe the company, product, audience or theme..."
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Additional stylistic instructions
            </label>
            <textarea
              value={additionalInstructions}
              onChange={(e) => setAdditionalInstructions(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
              placeholder="Minimal, premium, playful, geometric, soft shadows..."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Seed
              </label>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Resolution
              </label>
              <input
                type="text"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
                placeholder="4K"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Aspect ratio
              </label>
              <input
                type="text"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
                placeholder="1:1"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Filename prefix
              </label>
              <input
                type="text"
                value={filenamePrefixBase}
                onChange={(e) => setFilenamePrefixBase(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
                placeholder="ComfyUI"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSending}
            className="rounded-lg bg-white px-5 py-3 font-medium text-black disabled:opacity-50"
          >
            {isSending ? "Przetwarzanie..." : "Generate icon pack"}
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
      </section>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-3 text-2xl font-semibold">Output</h2>

        {gridFile ? (
          <div className="mb-6">
            <div className="mb-3 text-sm uppercase tracking-[0.15em] text-zinc-500">
              Preview grid
            </div>
            <img
              src={`${tool.outputRoute}?${new URLSearchParams({
                filename: gridFile.filename,
                subfolder: gridFile.subfolder ?? "",
                type: gridFile.type ?? "output",
              }).toString()}`}
              alt={gridFile.filename}
              className="w-full rounded-2xl border border-zinc-800 bg-black"
            />
          </div>
        ) : (
          <div className="mb-6 rounded-2xl border border-dashed border-zinc-700 bg-black/30 p-8 text-zinc-500">
            The 3x3 icon grid preview will appear here after generation.
          </div>
        )}

        {iconFiles.length > 0 ? (
          <div>
            <div className="mb-3 text-sm uppercase tracking-[0.15em] text-zinc-500">
              Exported icons
            </div>
            <div className="grid gap-4 grid-cols-2 xl:grid-cols-3">
              {iconFiles.map((item, index) => {
                const params = new URLSearchParams({
                  filename: item.filename,
                  subfolder: item.subfolder ?? "",
                  type: item.type ?? "output",
                });

                return (
                  <img
                    key={`${item.filename}-${index}`}
                    src={`${tool.outputRoute}?${params.toString()}`}
                    alt={item.filename}
                    className="w-full rounded-xl border border-zinc-800 bg-black"
                  />
                );
              })}
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
      </section>
    </div>
  );
}
