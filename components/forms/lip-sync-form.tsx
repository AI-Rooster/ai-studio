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
      uploadedImage: string;
      uploadedAudio: string;
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
  return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov") || lower.endsWith(".mkv");
}

function isGifFile(filename: string) {
  return filename.toLowerCase().endsWith(".gif");
}

type Props = {
  tool: ToolDefinition;
};

export default function LipSyncForm({ tool }: Props) {
  const [image, setImage] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [positivePrompt, setPositivePrompt] = useState(
    "The character looks towards the suspended microphone and raps passionately. Very emotional performance"
  );
  const [negativePrompt, setNegativePrompt] = useState(
    "bright tones, overexposed, static, blurred details, subtitles, static, overall gray, worst quality, low quality, JPEG compression residue, incomplete, extra fingers, poorly drawn hands, poorly drawn faces, deformed, disfigured, fused fingers, still picture, messy background, walking backwards"
  );
  const [width, setWidth] = useState(480);
  const [height, setHeight] = useState(832);
  const [fps, setFps] = useState(25);
  const [numFrames, setNumFrames] = useState(750);
  const [seed, setSeed] = useState(940918897846710);
  const [steps, setSteps] = useState(7);
  const [cfg, setCfg] = useState(1);
  const [shift, setShift] = useState(11);
  const [filenamePrefix, setFilenamePrefix] = useState("video/ComfyUI");
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

  const videoFiles = useMemo(() => {
    return outputFiles.filter((item) => isVideoFile(item.filename) || isGifFile(item.filename));
  }, [outputFiles]);

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
    const maxAttempts = 240;

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

    if (!image) {
      setError("Dodaj obraz startowy.");
      return;
    }

    if (!audio) {
      setError("Dodaj plik audio.");
      return;
    }

    try {
      setIsSending(true);

      const formData = new FormData();
      formData.append("image", image);
      formData.append("audio", audio);
      formData.append("positivePrompt", positivePrompt);
      formData.append("negativePrompt", negativePrompt);
      formData.append("width", String(width));
      formData.append("height", String(height));
      formData.append("fps", String(fps));
      formData.append("numFrames", String(numFrames));
      formData.append("seed", String(seed));
      formData.append("steps", String(steps));
      formData.append("cfg", String(cfg));
      formData.append("shift", String(shift));
      formData.append("filenamePrefix", filenamePrefix);

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
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="mb-3 text-2xl font-semibold text-white">{tool.title}</h2>
      <p className="mb-6 text-zinc-400">{tool.longDescription}</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
            <label className="mb-2 block text-sm font-medium text-zinc-300">Portrait image</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            />
          </div>

          <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
            <label className="mb-2 block text-sm font-medium text-zinc-300">Audio file</label>
            <input
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/webm"
              onChange={(e) => setAudio(e.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Positive prompt</label>
            <textarea
              value={positivePrompt}
              onChange={(e) => setPositivePrompt(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Negative prompt</label>
            <textarea
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Width</label>
            <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Height</label>
            <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">FPS</label>
            <input type="number" value={fps} onChange={(e) => setFps(Number(e.target.value))} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Frames</label>
            <input type="number" value={numFrames} onChange={(e) => setNumFrames(Number(e.target.value))} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Seed</label>
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Steps</label>
            <input type="number" value={steps} onChange={(e) => setSteps(Number(e.target.value))} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">CFG</label>
            <input type="number" step="0.1" value={cfg} onChange={(e) => setCfg(Number(e.target.value))} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Shift</label>
            <input type="number" step="0.1" value={shift} onChange={(e) => setShift(Number(e.target.value))} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none" />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Filename prefix</label>
          <input
            type="text"
            value={filenamePrefix}
            onChange={(e) => setFilenamePrefix(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
          />
        </div>

        <button type="submit" disabled={isSending} className="rounded-lg bg-white px-5 py-3 font-medium text-black disabled:opacity-50">
          {isSending ? "Przetwarzanie..." : "Generate lip-sync video"}
        </button>
      </form>

      {promptId ? (
        <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-zinc-200">
          <div><strong>promptId:</strong> {promptId}</div>
          <div><strong>status:</strong> {status || "—"}</div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-200">{error}</div>
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
              const src = `${tool.outputRoute}?${params.toString()}`;

              if (isGifFile(item.filename)) {
                return <img key={`${item.filename}-${index}`} src={src} alt={item.filename} className="w-full rounded-xl border border-zinc-800 bg-black" />;
              }

              return <video key={`${item.filename}-${index}`} src={src} controls playsInline className="w-full rounded-xl border border-zinc-800 bg-black" />;
            })}
          </div>
        </div>
      ) : null}

      {jobDetails ? (
        <details className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <summary className="cursor-pointer text-zinc-200">Pokaż surowe dane joba</summary>
          <pre className="mt-4 overflow-auto text-xs text-zinc-400">{JSON.stringify(jobDetails, null, 2)}</pre>
        </details>
      ) : null}
    </div>
  );
}
