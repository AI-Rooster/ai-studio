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

function isAudioFile(filename: string) {
  const lower = filename.toLowerCase();
  return lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".flac") || lower.endsWith(".ogg") || lower.endsWith(".m4a");
}

export default function TextToVoiceForm() {
  const [voiceSample, setVoiceSample] = useState<File | null>(null);
  const [text, setText] = useState("Welcome to AI Studio. This is your generated voiceover sample.");
  const [language, setLanguage] = useState("English (en)");
  const [exaggeration, setExaggeration] = useState(0.5);
  const [cfgWeight, setCfgWeight] = useState(0.5);
  const [temperature, setTemperature] = useState(0.8);
  const [repetitionPenalty, setRepetitionPenalty] = useState(2);
  const [minP, setMinP] = useState(0.05);
  const [topP, setTopP] = useState(1);
  const [seed, setSeed] = useState(163260306);
  const [filenamePrefix, setFilenamePrefix] = useState("audio/ComfyUI");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [promptId, setPromptId] = useState("");
  const [status, setStatus] = useState("");
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);

  const outputFiles = useMemo(() => {
    if (!jobDetails?.outputs) return [];
    return uniqOutputFiles(collectOutputFiles(jobDetails.outputs)).filter(
      (item) => (item.type ?? "output") === "output" && isAudioFile(item.filename)
    );
  }, [jobDetails]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPromptId("");
    setStatus("");
    setJobDetails(null);

    if (!voiceSample) {
      setError("Dodaj próbkę głosu.");
      return;
    }

    try {
      setIsSending(true);
      const formData = new FormData();
      formData.append("voiceSample", voiceSample);
      formData.append("text", text);
      formData.append("language", language);
      formData.append("exaggeration", String(exaggeration));
      formData.append("cfgWeight", String(cfgWeight));
      formData.append("temperature", String(temperature));
      formData.append("repetitionPenalty", String(repetitionPenalty));
      formData.append("minP", String(minP));
      formData.append("topP", String(topP));
      formData.append("seed", String(seed));
      formData.append("filenamePrefix", filenamePrefix);

      const response = await fetch("/api/tools/text-to-voice/generate", { method: "POST", body: formData });
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
      <h2 className="mb-3 text-2xl font-semibold text-white">Text to Voice</h2>
      <p className="mb-6 text-zinc-400">Upload a reference voice sample and generate spoken audio from text.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Reference voice</label>
          <input type="file" accept="audio/wav,audio/mp3,audio/mpeg,audio/x-m4a,audio/flac" onChange={(e) => setVoiceSample(e.target.files?.[0] ?? null)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Script</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white">
              <option>English (en)</option>
              <option>Spanish (es)</option>
              <option>Polish (pl)</option>
              <option>German (de)</option>
              <option>French (fr)</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Exaggeration</label>
            <input type="number" step="0.05" value={exaggeration} onChange={(e) => setExaggeration(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">CFG weight</label>
            <input type="number" step="0.05" value={cfgWeight} onChange={(e) => setCfgWeight(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Temperature</label>
            <input type="number" step="0.05" value={temperature} onChange={(e) => setTemperature(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Repetition penalty</label>
            <input type="number" step="0.1" value={repetitionPenalty} onChange={(e) => setRepetitionPenalty(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Min P</label>
            <input type="number" step="0.01" value={minP} onChange={(e) => setMinP(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Top P</label>
            <input type="number" step="0.01" value={topP} onChange={(e) => setTopP(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Seed</label>
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
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
        <div className="mt-8 grid gap-4">
          {outputFiles.map((file) => (
            <div key={`${file.subfolder}-${file.filename}`} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <audio controls src={buildOutputUrl(file)} className="w-full" />
              <div className="mt-3 flex items-center justify-between gap-4">
                <p className="truncate text-xs text-zinc-500">{file.filename}</p>
                <a href={buildOutputUrl(file)} target="_blank" rel="noreferrer" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200">Open file</a>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
