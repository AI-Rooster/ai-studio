"use client";

import { useState } from "react";

type GenerateResponse =
  | {
      ok: true;
      promptId: string;
      uploadedFile: string;
      workflowPath: string;
      loadImageNodeId: string;
    }
  | {
      ok: false;
      error: string;
    };

export default function GenerateImageForm() {
  const [file, setFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!file) {
      setError("Najpierw wybierz plik.");
      return;
    }

    try {
      setIsSending(true);

      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/generate-image", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as GenerateResponse;

      if (!response.ok || !data.ok) {
        throw new Error("error" in data ? data.error : "Nie udało się wysłać joba.");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 mt-8">
      <h2 className="text-2xl font-semibold mb-3">Generator obrazów</h2>
      <p className="text-zinc-400 mb-6">
        Wgraj 1 obraz, a backend wyśle go do Comfy Cloud i uruchomi workflow.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const selected = e.target.files?.[0] ?? null;
            setFile(selected);
          }}
          className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3"
        />

        <button
          type="submit"
          disabled={isSending}
          className="rounded-lg bg-white text-black font-medium px-5 py-3 disabled:opacity-50"
        >
          {isSending ? "Wysyłanie..." : "Wyślij do Comfy Cloud"}
        </button>
      </form>

      {error ? (
        <div className="mt-5 rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-200">
          {error}
        </div>
      ) : null}

      {result?.ok ? (
        <div className="mt-5 rounded-lg border border-emerald-900 bg-emerald-950/30 p-4 text-emerald-200">
          <div className="mb-2">Job został wysłany.</div>
          <div><strong>promptId:</strong> {result.promptId}</div>
          <div><strong>uploadedFile:</strong> {result.uploadedFile}</div>
          <div><strong>workflow:</strong> {result.workflowPath}</div>
          <div><strong>node obrazu:</strong> {result.loadImageNodeId}</div>
        </div>
      ) : null}
    </div>
  );
}