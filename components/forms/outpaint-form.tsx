"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ToolHandoffBanner from "@/components/forms/tool-handoff-banner";
import { readToolHandoffFromSearchParams } from "@/lib/tool-handoff";
import {
  buildOutputUrl,
  collectOutputFiles,
  isImageFile,
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

export default function OutpaintForm({
  toolId = "outpaint",
  title = "Outpaint",
  description = "Upload one image and extend it into new canvas space.",
}: FormProps) {
  const [image, setImage] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [seed, setSeed] = useState(164211176398261);
  const [steps, setSteps] = useState(20);
  const [guidance, setGuidance] = useState(30);
  const [left, setLeft] = useState(400);
  const [top, setTop] = useState(0);
  const [right, setRight] = useState(400);
  const [bottom, setBottom] = useState(400);
  const [feathering, setFeathering] = useState(40);
  const [filenamePrefix, setFilenamePrefix] = useState("ComfyUI");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [promptId, setPromptId] = useState("");
  const [status, setStatus] = useState("");
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);
  const searchParams = useSearchParams();
  const handoff = useMemo(() => readToolHandoffFromSearchParams(searchParams), [searchParams]);
  const [handoffApplied, setHandoffApplied] = useState(false);

  useEffect(() => {
    if (handoffApplied || !handoff) return;
    if (handoff.prompt) setPrompt(handoff.prompt);
    setHandoffApplied(true);
  }, [handoffApplied, handoff]);

  const outputFiles = useMemo(() => {
    if (!jobDetails?.outputs) return [];
    return uniqOutputFiles(collectOutputFiles(jobDetails.outputs)).filter(
      (item) => (item.type ?? "output") === "output" && isImageFile(item.filename)
    );
  }, [jobDetails]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPromptId("");
    setStatus("");
    setJobDetails(null);

    if (!image) {
      setError("Najpierw wybierz obraz wejściowy.");
      return;
    }

    try {
      setIsSending(true);
      const formData = new FormData();
      formData.append("image", image);
      formData.append("prompt", prompt);
      formData.append("seed", String(seed));
      formData.append("steps", String(steps));
      formData.append("guidance", String(guidance));
      formData.append("left", String(left));
      formData.append("top", String(top));
      formData.append("right", String(right));
      formData.append("bottom", String(bottom));
      formData.append("feathering", String(feathering));
      formData.append("filenamePrefix", filenamePrefix);

      const response = await fetch(`/api/tools/${toolId}/generate`, { method: "POST", body: formData });
      const data = (await response.json()) as GenerateResponse;
      if (!response.ok || !data.ok) {
        throw new Error("error" in data ? data.error : "Nie udało się wysłać joba.");
      }

      setPromptId(data.promptId);
      setStatus("pending");
      const details = await pollUntilFinished(data.promptId, setStatus, 180);
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
          <label className="mb-2 block text-sm font-medium text-zinc-300">Input image</label>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setImage(e.target.files?.[0] ?? null)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Prompt</label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" placeholder="Describe what should appear in the newly expanded space..." />
        </div>

        <div className="grid gap-6 md:grid-cols-5">
          {[
            ["Left", left, setLeft],
            ["Top", top, setTop],
            ["Right", right, setRight],
            ["Bottom", bottom, setBottom],
            ["Feathering", feathering, setFeathering],
          ].map(([label, value, setter]) => (
            <div key={String(label)}>
              <label className="mb-2 block text-sm font-medium text-zinc-300">{label}</label>
              <input type="number" value={Number(value)} min={0} onChange={(e) => (setter as (n: number) => void)(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
            </div>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Seed</label>
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Steps</label>
            <input type="number" value={steps} min={1} onChange={(e) => setSteps(Number(e.target.value) || 1)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Guidance</label>
            <input type="number" value={guidance} min={1} step="0.1" onChange={(e) => setGuidance(Number(e.target.value) || 1)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Filename prefix</label>
            <input value={filenamePrefix} onChange={(e) => setFilenamePrefix(e.target.value)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
          </div>
        </div>

        <button disabled={isSending} type="submit" className="rounded-lg bg-white px-5 py-3 font-medium text-black disabled:opacity-50">
          {isSending ? "Generating..." : "Generate"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      {promptId ? <p className="mt-4 text-sm text-zinc-400">Prompt ID: {promptId}</p> : null}
      {status ? <p className="mt-2 text-sm text-zinc-400">Status: {status}</p> : null}

      {outputFiles.length ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {outputFiles.map((file) => (
            <div key={`${file.subfolder}-${file.filename}`} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <img src={buildOutputUrl(file)} alt={file.filename} className="h-auto w-full rounded-lg" />
              <p className="mt-2 truncate text-xs text-zinc-500">{file.filename}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
