"use client";

import { useMemo, useState } from "react";
import {
  buildOutputUrl,
  collectOutputFiles,
  JobDetails,
  pollUntilFinished,
  uniqOutputFiles,
} from "@/lib/job-client";

type GenerateResponse =
  | { ok: true; promptId: string; uploadedFile: string; workflowPath: string }
  | { ok: false; error: string };

function isMeshFile(filename: string) {
  const lower = filename.toLowerCase();
  return lower.endsWith(".glb") || lower.endsWith(".gltf") || lower.endsWith(".obj") || lower.endsWith(".ply") || lower.endsWith(".stl");
}

export default function PictureTo3DForm() {
  const [image, setImage] = useState<File | null>(null);
  const [resolution, setResolution] = useState(4096);
  const [seed, setSeed] = useState(952805179515179);
  const [steps, setSteps] = useState(30);
  const [cfg, setCfg] = useState(5);
  const [shift, setShift] = useState(1);
  const [threshold, setThreshold] = useState(0.6);
  const [filenamePrefix, setFilenamePrefix] = useState("mesh/ComfyUI");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [promptId, setPromptId] = useState("");
  const [status, setStatus] = useState("");
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);

  const outputFiles = useMemo(() => {
    if (!jobDetails?.outputs) return [];
    return uniqOutputFiles(collectOutputFiles(jobDetails.outputs)).filter(
      (item) => (item.type ?? "output") === "output" && isMeshFile(item.filename)
    );
  }, [jobDetails]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPromptId("");
    setStatus("");
    setJobDetails(null);

    if (!image) {
      setError("Dodaj obraz wejściowy.");
      return;
    }

    try {
      setIsSending(true);
      const formData = new FormData();
      formData.append("image", image);
      formData.append("resolution", String(resolution));
      formData.append("seed", String(seed));
      formData.append("steps", String(steps));
      formData.append("cfg", String(cfg));
      formData.append("shift", String(shift));
      formData.append("threshold", String(threshold));
      formData.append("filenamePrefix", filenamePrefix);

      const response = await fetch("/api/tools/picture-to-3d/generate", { method: "POST", body: formData });
      const data = (await response.json()) as GenerateResponse;
      if (!response.ok || !data.ok) {
        throw new Error("error" in data ? data.error : "Nie udało się wysłać joba.");
      }

      setPromptId(data.promptId);
      setStatus("pending");
      const details = await pollUntilFinished(data.promptId, setStatus, 300);
      setJobDetails(details);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="mb-3 text-2xl font-semibold text-white">Picture to 3D</h2>
      <p className="mb-6 text-zinc-400">Upload one image and generate a downloadable 3D mesh.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Input image</label>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setImage(e.target.files?.[0] ?? null)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">Resolution</label><select value={String(resolution)} onChange={(e) => setResolution(Number(e.target.value))} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"><option value="1024">1024</option><option value="2048">2048</option><option value="4096">4096</option></select></div>
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">Seed</label><input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">Steps</label><input type="number" value={steps} onChange={(e) => setSteps(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">CFG</label><input type="number" step="0.1" value={cfg} onChange={(e) => setCfg(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">Shift</label><input type="number" step="0.1" value={shift} onChange={(e) => setShift(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">Threshold</label><input type="number" step="0.01" value={threshold} onChange={(e) => setThreshold(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">Filename prefix</label><input value={filenamePrefix} onChange={(e) => setFilenamePrefix(e.target.value)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
        </div>

        <button disabled={isSending} type="submit" className="rounded-lg bg-white px-5 py-3 font-medium text-black disabled:opacity-50">{isSending ? "Generating..." : "Generate"}</button>
      </form>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      {promptId ? <p className="mt-4 text-sm text-zinc-400">Prompt ID: {promptId}</p> : null}
      {status ? <p className="mt-2 text-sm text-zinc-400">Status: {status}</p> : null}

      {outputFiles.length ? (
        <div className="mt-8 grid gap-4">
          {outputFiles.map((file) => (
            <div key={`${file.subfolder}-${file.filename}`} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">3D mesh ready</p>
                  <p className="truncate text-xs text-zinc-500">{file.filename}</p>
                </div>
                <a href={buildOutputUrl(file)} target="_blank" rel="noreferrer" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200">Download</a>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
