"use client";

import { useMemo, useState } from "react";
import { ToolDefinition } from "@/lib/tools/types";
import ImageGalleryRenderer from "@/components/renderers/image-gallery-renderer";

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
      loadImageNodeId: string;
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

type SingleImageToolFormProps = {
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

export default function SingleImageToolForm({ tool }: SingleImageToolFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [promptId, setPromptId] = useState("");
  const [status, setStatus] = useState("");
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);

  const outputFiles = useMemo(() => {
    if (!jobDetails?.outputs) return [];

    return uniqOutputFiles(collectOutputFiles(jobDetails.outputs)).filter(
      (item) => item.type === "output"
    );
  }, [jobDetails]);

  async function fetchJobDetails(currentPromptId: string) {
    if (!tool.detailsRouteBase) {
      throw new Error("Missing details route for this tool.");
    }

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
    if (!tool.statusRouteBase) {
      throw new Error("Missing status route for this tool.");
    }

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

    if (!tool.generateRoute) {
      setError("This tool is not connected yet.");
      return;
    }

    setError("");
    setPromptId("");
    setStatus("");
    setJobDetails(null);

    if (!file) {
      setError("Najpierw wybierz plik.");
      return;
    }

    try {
      setIsSending(true);

      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch(tool.generateRoute, {
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
        <h2 className="mb-3 text-2xl font-semibold">Generate</h2>
        <p className="mb-6 text-zinc-400">
          Upload one source image and generate a new batch of outputs with this tool.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="file"
            accept={tool.accepts.join(",")}
            onChange={(e) => {
              const selected = e.target.files?.[0] ?? null;
              setFile(selected);
            }}
            className="block w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
          />

          <button
            type="submit"
            disabled={isSending}
            className="rounded-xl bg-white px-5 py-3 font-medium text-black disabled:opacity-50"
          >
            {isSending ? "Przetwarzanie..." : "Generate"}
          </button>
        </form>

        {promptId ? (
          <div className="mt-5 rounded-xl border border-zinc-800 bg-black/30 p-4 text-sm text-zinc-200">
            <div>
              <strong>promptId:</strong> {promptId}
            </div>
            <div>
              <strong>status:</strong> {status || "—"}
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {jobDetails ? (
          <details className="mt-6 rounded-xl border border-zinc-800 bg-black/30 p-4">
            <summary className="cursor-pointer text-sm text-zinc-200">
              Show raw job details
            </summary>
            <pre className="mt-4 overflow-auto text-xs text-zinc-400">
              {JSON.stringify(jobDetails, null, 2)}
            </pre>
          </details>
        ) : null}
      </section>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-3 text-2xl font-semibold">Results</h2>
        <p className="mb-6 text-zinc-400">
          Final outputs from this tool appear here when the job completes.
        </p>

        {outputFiles.length > 0 && tool.outputRoute ? (
          <ImageGalleryRenderer files={outputFiles} outputRoute={tool.outputRoute} />
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-black/30 p-8 text-zinc-500">
            No outputs yet.
          </div>
        )}
      </section>
    </div>
  );
}
