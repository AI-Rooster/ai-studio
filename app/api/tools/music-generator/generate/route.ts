import { NextResponse } from "next/server";
import {
  getComfyApiKey,
  getOptionalExtraData,
  loadWorkflowFromDisk,
  setInputValue,
  submitWorkflowToComfy,
} from "@/lib/comfy/cloud";

export const runtime = "nodejs";

function toStringValue(value: FormDataEntryValue | null, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function toNumberValue(value: FormDataEntryValue | null, fallback: number) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ ok: false, error: `Zły content-type: ${contentType || "(brak)"}` }, { status: 400 });
    }

    const apiKey = getComfyApiKey();
    const formData = await request.formData();

    const tags = toStringValue(formData.get("tags"), "Cinematic electronic pop with a strong beat.");
    const lyrics = toStringValue(formData.get("lyrics"), "[Verse]\nThis is a placeholder lyric.");
    const seed = toNumberValue(formData.get("seed"), 31);
    const bpm = toNumberValue(formData.get("bpm"), 120);
    const duration = toNumberValue(formData.get("duration"), 60);
    const timeSignature = toStringValue(formData.get("timeSignature"), "4");
    const language = toStringValue(formData.get("language"), "en");
    const keyscale = toStringValue(formData.get("keyscale"), "C major");
    const cfgScale = toNumberValue(formData.get("cfgScale"), 2);
    const temperature = toNumberValue(formData.get("temperature"), 0.85);
    const topP = toNumberValue(formData.get("topP"), 0.9);
    const topK = toNumberValue(formData.get("topK"), 0);
    const minP = toNumberValue(formData.get("minP"), 0);
    const steps = toNumberValue(formData.get("steps"), 8);
    const cfg = toNumberValue(formData.get("cfg"), 1);
    const shift = toNumberValue(formData.get("shift"), 3);
    const filenamePrefix = toStringValue(formData.get("filenamePrefix"), "audio/ComfyUI");

    const workflow = await loadWorkflowFromDisk("music-generator.json");

    setInputValue(workflow, "94", "tags", tags);
    setInputValue(workflow, "94", "lyrics", lyrics);
    setInputValue(workflow, "94", "seed", seed);
    setInputValue(workflow, "94", "bpm", bpm);
    setInputValue(workflow, "94", "duration", duration);
    setInputValue(workflow, "94", "timesignature", timeSignature);
    setInputValue(workflow, "94", "language", language);
    setInputValue(workflow, "94", "keyscale", keyscale);
    setInputValue(workflow, "94", "cfg_scale", cfgScale);
    setInputValue(workflow, "94", "temperature", temperature);
    setInputValue(workflow, "94", "top_p", topP);
    setInputValue(workflow, "94", "top_k", topK);
    setInputValue(workflow, "94", "min_p", minP);
    setInputValue(workflow, "98", "seconds", duration);
    setInputValue(workflow, "3", "seed", seed);
    setInputValue(workflow, "3", "steps", steps);
    setInputValue(workflow, "3", "cfg", cfg);
    setInputValue(workflow, "78", "shift", shift);
    setInputValue(workflow, "107", "filename_prefix", filenamePrefix);

    const submitResult = await submitWorkflowToComfy(workflow, apiKey, getOptionalExtraData());

    return NextResponse.json({
      ok: true,
      promptId: submitResult.prompt_id,
      workflowPath: "workflow/music-generator.json",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nieznany błąd serwera.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
