"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ToolHandoffBanner from "@/components/forms/tool-handoff-banner";
import { readToolHandoffFromSearchParams } from "@/lib/tool-handoff";
import {
  buildOutputUrl,
  collectOutputFiles,
  isGifFile,
  isVideoFile,
  JobDetails,
  pollUntilFinished,
  uniqOutputFiles,
} from "@/lib/job-client";

type FormProps = {
  toolId?: string;
  title?: string;
  description?: string;
};

type GenerateResponse =
  | { ok: true; promptId: string; uploadedFile: string; workflowPath: string }
  | { ok: false; error: string };

export default function UpscaleVideoForm({
  toolId = "upscale-video",
  title = "Upscale Video",
  description = "Upload a video, upscale frames, and rebuild the clip with original audio.",
}: FormProps) {
  const [video, setVideo] = useState<File | null>(null);
  const [filenamePrefix, setFilenamePrefix] = useState("video/ComfyUI");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [promptId, setPromptId] = useState("");
  const [status, setStatus] = useState("");
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);
  const searchParams = useSearchParams();
  const handoff = useMemo(() => readToolHandoffFromSearchParams(searchParams), [searchParams]);

  const outputFiles = useMemo(() => {
    if (!jobDetails?.outputs) return [];
    return uniqOutputFiles(collectOutputFiles(jobDetails.outputs)).filter(
      (item) => (item.type ?? "output") === "output"
    );
  }, [jobDetails]);

  const videoFiles = useMemo(() => {
    return outputFiles.filter((item) => isVideoFile(item.filename) || isGifFile(item.filename));
  }, [outputFiles]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPromptId("");
    setStatus("");
    setJobDetails(null);

    if (!video) {
      setError("Najpierw wybierz plik wideo.");
      return;
    }

    try {
      setIsSending(true);
      const formData = new FormData();
      formData.append("video", video);
      formData.append("filenamePrefix", filenamePrefix);

      const response = await fetch(`/api/tools/${toolId}/generate`, { method: "POST", body: formData });
      const data = (await response.json()) as GenerateResponse;
      if (!response.ok || !data.ok) {
        throw new Error("error" in data ? data.error : "Nie udało się wysłać joba.");
      }

      setPromptId(data.promptId);
      setStatus("pending");
      const details = await pollUntilFinished(data.promptId, setStatus, 240);
      setJobDetails(details);
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

      {handoff ? <div className="mb-6"><ToolHandoffBanner handoff={handoff} /></div> : null}
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Input video</label>
          <input type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Filename prefix</label>
          <input value={filenamePrefix} onChange={(e) => setFilenamePrefix(e.target.value)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
        </div>

        <button disabled={isSending} type="submit" className="rounded-lg bg-white px-5 py-3 font-medium text-black disabled:opacity-50">
          {isSending ? "Generating..." : "Generate"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      {promptId ? <p className="mt-4 text-sm text-zinc-400">Prompt ID: {promptId}</p> : null}
      {status ? <p className="mt-2 text-sm text-zinc-400">Status: {status}</p> : null}

      {videoFiles.length ? (
        <div className="mt-8 grid gap-4">
          {videoFiles.map((file) => (
            <div key={`${file.subfolder}-${file.filename}`} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <video src={buildOutputUrl(file)} controls className="w-full rounded-lg" />
              <p className="mt-2 truncate text-xs text-zinc-500">{file.filename}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
