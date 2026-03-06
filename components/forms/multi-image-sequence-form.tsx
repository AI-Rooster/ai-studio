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
      uploadedFiles: string[];
      workflowPath: string;
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

function isVideoFile(filename: string) {
  const lower = filename.toLowerCase();
  return (
    lower.endsWith(".mp4") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".mkv")
  );
}

function isGifFile(filename: string) {
  return filename.toLowerCase().endsWith(".gif");
}

export default function MultiImageSequenceForm({
  toolId = "six-frame-video",
  title = "6-Frame Motion",
  description = "Upload exactly 6 frames and generate one video.",
}: FormProps) {
  const [frames, setFrames] = useState<(File | null)[]>([
    null,
    null,
    null,
    null,
    null,
    null,
  ]);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [width, setWidth] = useState(720);
  const [height, setHeight] = useState(720);
  const [segmentLength, setSegmentLength] = useState(25);
  const [fps, setFps] = useState(24);
  const [filenamePrefix, setFilenamePrefix] = useState("video/ComfyUI");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [promptId, setPromptId] = useState("");
  const [status, setStatus] = useState("");
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);

  function updateFrame(index: number, file: File | null) {
    setFrames((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
  }

  const outputFiles = useMemo(() => {
    if (!jobDetails?.outputs) return [];

    return uniqOutputFiles(collectOutputFiles(jobDetails.outputs)).filter(
      (item) => (item.type ?? "output") === "output"
    );
  }, [jobDetails]);

  const videoFiles = useMemo(() => {
    return outputFiles.filter((item) => isVideoFile(item.filename) || isGifFile(item.filename));
  }, [outputFiles]);

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

    const validFrames = frames.filter(Boolean) as File[];

    if (validFrames.length !== 6) {
      setError("Musisz dodać dokładnie 6 obrazów.");
      return;
    }

    try {
      setIsSending(true);

      const formData = new FormData();

      validFrames.forEach((file) => {
        formData.append("frames", file);
      });

      formData.append("prompt", prompt);
      formData.append("negativePrompt", negativePrompt);
      formData.append("width", String(width));
      formData.append("height", String(height));
      formData.append("segmentLength", String(segmentLength));
      formData.append("fps", String(fps));
      formData.append("filenamePrefix", filenamePrefix);

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
      <h2 className="mb-3 text-2xl font-semibold text-white">{title}</h2>
      <p className="mb-6 text-zinc-400">{description}</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {frames.map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-zinc-800 bg-black/40 p-4"
            >
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Frame {index + 1}
              </label>

              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  updateFrame(index, file);
                }}
                className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
              />
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
              placeholder="Describe the motion..."
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Negative prompt
            </label>
            <textarea
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
              placeholder="Optional negative prompt..."
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Width
            </label>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Height
            </label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Segment length
            </label>
            <input
              type="number"
              value={segmentLength}
              onChange={(e) => setSegmentLength(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              FPS
            </label>
            <input
              type="number"
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Filename prefix
            </label>
            <input
              type="text"
              value={filenamePrefix}
              onChange={(e) => setFilenamePrefix(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSending}
          className="rounded-lg bg-white px-5 py-3 font-medium text-black disabled:opacity-50"
        >
          {isSending ? "Przetwarzanie..." : "Generate video"}
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

      {videoFiles.length > 0 ? (
        <div className="mt-8">
          <h3 className="mb-4 text-xl font-semibold text-white">Video output</h3>

          <div className="space-y-6">
            {videoFiles.map((item, index) => {
              const params = new URLSearchParams({
                filename: item.filename,
                subfolder: item.subfolder ?? "",
                type: item.type ?? "output",
              });

              const src = `/api/output?${params.toString()}`;

              if (isGifFile(item.filename)) {
                return (
                  <img
                    key={`${item.filename}-${index}`}
                    src={src}
                    alt={item.filename}
                    className="w-full rounded-xl border border-zinc-800 bg-black"
                  />
                );
              }

              return (
                <video
                  key={`${item.filename}-${index}`}
                  src={src}
                  controls
                  playsInline
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
    </div>
  );
}