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
  | { ok: true; promptId: string; uploadedFiles: string[]; workflowPath: string }
  | { ok: false; error: string };

export default function ProductMockupForm({
  toolId = "product-mockup",
  title = "Product Mockup",
  description = "Upload a design reference and a target image, then apply the design to the target.",
}: FormProps) {
  const [designImage, setDesignImage] = useState<File | null>(null);
  const [targetImage, setTargetImage] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("Apply the design from Reference Image 1 onto objects in Reference Image 2.");
  const [seed, setSeed] = useState(120839687766682);
  const [megapixels, setMegapixels] = useState(1);
  const [standardSteps, setStandardSteps] = useState(20);
  const [turboSteps, setTurboSteps] = useState(8);
  const [filenamePrefix, setFilenamePrefix] = useState("Flux2");
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

    if (!designImage || !targetImage) {
      setError("Dodaj obraz designu i obraz docelowy.");
      return;
    }

    try {
      setIsSending(true);
      const formData = new FormData();
      formData.append("designImage", designImage);
      formData.append("targetImage", targetImage);
      formData.append("prompt", prompt);
      formData.append("seed", String(seed));
      formData.append("megapixels", String(megapixels));
      formData.append("standardSteps", String(standardSteps));
      formData.append("turboSteps", String(turboSteps));
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
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Design reference</label>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setDesignImage(e.target.files?.[0] ?? null)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Target product / scene</label>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setTargetImage(e.target.files?.[0] ?? null)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Prompt</label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Seed</label>
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Megapixels</label>
            <input type="number" value={megapixels} step="0.25" min={0.25} onChange={(e) => setMegapixels(Number(e.target.value) || 1)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Standard steps</label>
            <input type="number" value={standardSteps} min={1} onChange={(e) => setStandardSteps(Number(e.target.value) || 1)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Turbo steps</label>
            <input type="number" value={turboSteps} min={1} onChange={(e) => setTurboSteps(Number(e.target.value) || 1)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
          </div>
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
