export type ErrorResponse = {
  ok: false;
  error: string;
};

export type JobStatusValue =
  | "waiting_to_dispatch"
  | "pending"
  | "in_progress"
  | "completed"
  | "success"
  | "failed"
  | "error"
  | "cancelled";

export type JobStatusResponse =
  | {
      ok: true;
      id?: string | null;
      status: JobStatusValue;
      raw?: unknown;
    }
  | ErrorResponse;

export type OutputFile = {
  filename: string;
  subfolder?: string;
  type?: string;
};

export type JobDetails = {
  id: string;
  status: string;
  outputs?: Record<string, unknown>;
  preview_output?: unknown;
  execution_error?: unknown;
};

export type JobDetailsResponse =
  | {
      ok: true;
      job: JobDetails;
    }
  | ErrorResponse;

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function collectOutputFiles(value: unknown, bucket: OutputFile[] = []): OutputFile[] {
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

export function uniqOutputFiles(files: OutputFile[]) {
  const map = new Map<string, OutputFile>();

  for (const file of files) {
    const key = `${file.type ?? "output"}::${file.subfolder ?? ""}::${file.filename}`;
    if (!map.has(key)) {
      map.set(key, file);
    }
  }

  return Array.from(map.values());
}

export function buildOutputUrl(file: OutputFile) {
  const params = new URLSearchParams({
    filename: file.filename,
    subfolder: file.subfolder ?? "",
    type: file.type ?? "output",
  });

  return `/api/output?${params.toString()}`;
}

export function isImageFile(filename: string) {
  const lower = filename.toLowerCase();
  return lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp");
}

export function isVideoFile(filename: string) {
  const lower = filename.toLowerCase();
  return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov") || lower.endsWith(".mkv");
}

export function isGifFile(filename: string) {
  return filename.toLowerCase().endsWith(".gif");
}

export async function fetchJobDetails(currentPromptId: string) {
  const response = await fetch(`/api/job-details/${currentPromptId}`, {
    cache: "no-store",
  });

  const data = (await response.json()) as JobDetailsResponse;
  if (!response.ok || !data.ok) {
    throw new Error("Nie udało się pobrać szczegółów joba.");
  }

  return data.job;
}

export async function pollUntilFinished(
  currentPromptId: string,
  setStatus: (status: string) => void,
  maxAttempts = 180
) {
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
      setStatus("completed");
      return details;
    }

    if (currentStatus === "failed" || currentStatus === "error") {
      throw new Error("Job zakończył się błędem.");
    }

    if (currentStatus === "cancelled") {
      throw new Error("Job został anulowany.");
    }

    await sleep(3000);
  }

  throw new Error("Przekroczono czas oczekiwania na wynik.");
}
