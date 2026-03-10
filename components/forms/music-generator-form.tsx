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
  | { ok: true; promptId: string; workflowPath: string }
  | { ok: false; error: string };

function isAudioFile(filename: string) {
  const lower = filename.toLowerCase();
  return lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".flac") || lower.endsWith(".ogg") || lower.endsWith(".m4a");
}

export default function MusicGeneratorForm() {
  const [tags, setTags] = useState("Cinematic electronic pop anthem with a polished, modern production and strong hook.");
  const [lyrics, setLyrics] = useState("[Verse]\nWe light it up and never slow down\n[Chorus]\nThis is our moment, own the sound");
  const [seed, setSeed] = useState(31);
  const [bpm, setBpm] = useState(120);
  const [duration, setDuration] = useState(60);
  const [timeSignature, setTimeSignature] = useState("4");
  const [language, setLanguage] = useState("en");
  const [keyscale, setKeyscale] = useState("C major");
  const [cfgScale, setCfgScale] = useState(2);
  const [temperature, setTemperature] = useState(0.85);
  const [topP, setTopP] = useState(0.9);
  const [topK, setTopK] = useState(0);
  const [minP, setMinP] = useState(0);
  const [steps, setSteps] = useState(8);
  const [cfg, setCfg] = useState(1);
  const [shift, setShift] = useState(3);
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

    try {
      setIsSending(true);
      const formData = new FormData();
      formData.append("tags", tags);
      formData.append("lyrics", lyrics);
      formData.append("seed", String(seed));
      formData.append("bpm", String(bpm));
      formData.append("duration", String(duration));
      formData.append("timeSignature", timeSignature);
      formData.append("language", language);
      formData.append("keyscale", keyscale);
      formData.append("cfgScale", String(cfgScale));
      formData.append("temperature", String(temperature));
      formData.append("topP", String(topP));
      formData.append("topK", String(topK));
      formData.append("minP", String(minP));
      formData.append("steps", String(steps));
      formData.append("cfg", String(cfg));
      formData.append("shift", String(shift));
      formData.append("filenamePrefix", filenamePrefix);

      const response = await fetch("/api/tools/music-generator/generate", { method: "POST", body: formData });
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
      <h2 className="mb-3 text-2xl font-semibold text-white">Music Generator</h2>
      <p className="mb-6 text-zinc-400">Generate a track from music tags, lyrics and song settings.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Music tags / prompt</label>
          <textarea value={tags} onChange={(e) => setTags(e.target.value)} rows={5} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Lyrics</label>
          <textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} rows={8} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">Seed</label><input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">BPM</label><input type="number" value={bpm} onChange={(e) => setBpm(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">Duration (s)</label><input type="number" value={duration} min={10} max={180} onChange={(e) => setDuration(Number(e.target.value) || 60)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">Time signature</label><input value={timeSignature} onChange={(e) => setTimeSignature(e.target.value)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">Language</label><input value={language} onChange={(e) => setLanguage(e.target.value)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">Key / scale</label><input value={keyscale} onChange={(e) => setKeyscale(e.target.value)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">CFG scale</label><input type="number" step="0.1" value={cfgScale} onChange={(e) => setCfgScale(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">Temperature</label><input type="number" step="0.05" value={temperature} onChange={(e) => setTemperature(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">Top P</label><input type="number" step="0.01" value={topP} onChange={(e) => setTopP(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">Top K</label><input type="number" value={topK} onChange={(e) => setTopK(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">Min P</label><input type="number" step="0.01" value={minP} onChange={(e) => setMinP(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">Steps</label><input type="number" value={steps} onChange={(e) => setSteps(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">CFG</label><input type="number" step="0.1" value={cfg} onChange={(e) => setCfg(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">Shift</label><input type="number" step="0.1" value={shift} onChange={(e) => setShift(Number(e.target.value) || 0)} className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" /></div>
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
