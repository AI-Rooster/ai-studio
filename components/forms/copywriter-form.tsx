"use client";

import { useMemo, useState } from "react";
import {
  JobDetails,
  JobStatusResponse,
  JobDetailsResponse,
  sleep,
} from "@/lib/job-client";

type GenerateResponse =
  | { ok: true; promptId: string; workflowPath: string }
  | { ok: false; error: string };

function extractText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(extractText).filter(Boolean).join("\n\n");
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const preferredKeys = ["text", "value", "content", "preview_text", "preview_markdown"];
    for (const key of preferredKeys) {
      if (typeof obj[key] === "string" && obj[key]) {
        return obj[key] as string;
      }
    }
    return Object.values(obj).map(extractText).filter(Boolean).join("\n\n");
  }

  return "";
}

export default function CopywriterForm() {
  const [prompt, setPrompt] = useState("Write 5 high-converting headline options for a premium stroller launch. Keep them concise and premium.");
  const [maxLength, setMaxLength] = useState(2048);
  const [temperature, setTemperature] = useState(0.7);
  const [topK, setTopK] = useState(64);
  const [topP, setTopP] = useState(0.95);
  const [minP, setMinP] = useState(0.05);
  const [repetitionPenalty, setRepetitionPenalty] = useState(1.05);
  const [seed, setSeed] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [promptId, setPromptId] = useState("");
  const [status, setStatus] = useState("");
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);

  const generatedText = useMemo(() => {
    if (!jobDetails) return "";
    return extractText(jobDetails.preview_output) || extractText(jobDetails.outputs) || extractText(jobDetails.execution_error);
  }, [jobDetails]);

  async function fetchJobDetails(currentPromptId: string) {
    const response = await fetch(`/api/job-details/${currentPromptId}`, { cache: "no-store" });
    const data = (await response.json()) as JobDetailsResponse;
    if (!response.ok || !data.ok) {
      throw new Error("Nie udało się pobrać szczegółów joba.");
    }
    return data.job;
  }

  async function poll(currentPromptId: string) {
    for (let attempt = 0; attempt < 180; attempt++) {
      const response = await fetch(`/api/job-status/${currentPromptId}`, { cache: "no-store" });
      const data = (await response.json()) as JobStatusResponse;
      if (!response.ok || !data.ok) {
        throw new Error("Nie udało się sprawdzić statusu joba.");
      }

      setStatus(data.status);

      if (data.status === "completed" || data.status === "success") {
        const details = await fetchJobDetails(currentPromptId);
        setJobDetails(details);
        setStatus("completed");
        return;
      }

      if (data.status === "failed" || data.status === "error" || data.status === "cancelled") {
        const details = await fetchJobDetails(currentPromptId).catch(() => null);
        if (details) setJobDetails(details);
        throw new Error("Job zakończył się błędem.");
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

    try {
      setIsSending(true);
      const formData = new FormData();
      formData.append("prompt", prompt);
      formData.append("maxLength", String(maxLength));
      formData.append("temperature", String(temperature));
      formData.append("topK", String(topK));
      formData.append("topP", String(topP));
      formData.append("minP", String(minP));
      formData.append("repetitionPenalty", String(repetitionPenalty));
      formData.append("seed", String(seed));

      const response = await fetch("/api/tools/copywriter/generate", { method: "POST", body: formData });
      const data = (await response.json()) as GenerateResponse;
      if (!response.ok || !data.ok) {
        throw new Error("error" in data ? data.error : "Nie udało się wysłać joba.");
      }

      setPromptId(data.promptId);
      setStatus("pending");
      await poll(data.promptId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-3 text-2xl font-semibold">Copywriter</h2>
        <p className="mb-6 text-zinc-400">Generate marketing copy from a plain text brief.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Brief / prompt</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={8} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div><label className="mb-2 block text-sm font-medium text-zinc-300">Max length</label><input type="number" value={maxLength} onChange={(e) => setMaxLength(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
            <div><label className="mb-2 block text-sm font-medium text-zinc-300">Temperature</label><input type="number" step="0.05" value={temperature} onChange={(e) => setTemperature(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
            <div><label className="mb-2 block text-sm font-medium text-zinc-300">Top K</label><input type="number" value={topK} onChange={(e) => setTopK(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
            <div><label className="mb-2 block text-sm font-medium text-zinc-300">Top P</label><input type="number" step="0.01" value={topP} onChange={(e) => setTopP(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div><label className="mb-2 block text-sm font-medium text-zinc-300">Min P</label><input type="number" step="0.01" value={minP} onChange={(e) => setMinP(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
            <div><label className="mb-2 block text-sm font-medium text-zinc-300">Repetition penalty</label><input type="number" step="0.01" value={repetitionPenalty} onChange={(e) => setRepetitionPenalty(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
            <div><label className="mb-2 block text-sm font-medium text-zinc-300">Seed</label><input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
          </div>

          <button disabled={isSending} type="submit" className="rounded-lg bg-white px-5 py-3 font-medium text-black disabled:opacity-50">{isSending ? "Generating..." : "Generate"}</button>
        </form>

        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
        {promptId ? <p className="mt-4 text-sm text-zinc-400">Prompt ID: {promptId}</p> : null}
        {status ? <p className="mt-2 text-sm text-zinc-400">Status: {status}</p> : null}
      </section>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-3 text-2xl font-semibold">Generated copy</h2>
        <p className="mb-6 text-zinc-400">This workflow returns text output instead of image or video files.</p>

        {generatedText ? (
          <div className="space-y-4">
            <textarea readOnly value={generatedText} rows={18} className="block w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100" />
            <button type="button" onClick={() => navigator.clipboard.writeText(generatedText)} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200">Copy text</button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-black/30 p-8 text-zinc-500">No text output yet.</div>
        )}

        {jobDetails ? (
          <details className="mt-6 rounded-2xl border border-zinc-800 bg-black/30 p-4">
            <summary className="cursor-pointer text-sm text-zinc-200">Show raw job details</summary>
            <pre className="mt-4 overflow-auto text-xs text-zinc-400">{JSON.stringify(jobDetails, null, 2)}</pre>
          </details>
        ) : null}
      </section>
    </div>
  );
}
