import { NextResponse } from "next/server";
import {
  getComfyApiKey,
  getOptionalExtraData,
  loadWorkflowFromDisk,
  setInputValue,
  submitWorkflowToComfy,
  uploadUserDataFile,
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
    const voiceSample = formData.get("voiceSample");

    if (!(voiceSample instanceof File)) {
      return NextResponse.json({ ok: false, error: "Nie przesłano próbki głosu." }, { status: 400 });
    }

    const text = toStringValue(formData.get("text"), "Hello from AI Studio.");
    const language = toStringValue(formData.get("language"), "English (en)");
    const exaggeration = toNumberValue(formData.get("exaggeration"), 0.5);
    const cfgWeight = toNumberValue(formData.get("cfgWeight"), 0.5);
    const temperature = toNumberValue(formData.get("temperature"), 0.8);
    const repetitionPenalty = toNumberValue(formData.get("repetitionPenalty"), 2);
    const minP = toNumberValue(formData.get("minP"), 0.05);
    const topP = toNumberValue(formData.get("topP"), 1);
    const seed = toNumberValue(formData.get("seed"), 163260306);
    const filenamePrefix = toStringValue(formData.get("filenamePrefix"), "audio/ComfyUI");

    const safeName = voiceSample.name.replace(/\s+/g, "-");
    const uploadResult = await uploadUserDataFile(voiceSample, apiKey, safeName);
    const workflow = await loadWorkflowFromDisk("text-to-voice.json");

    setInputValue(workflow, "1", "text", text);
    setInputValue(workflow, "1", "language", language);
    setInputValue(workflow, "1", "exaggeration", exaggeration);
    setInputValue(workflow, "1", "cfg_weight", cfgWeight);
    setInputValue(workflow, "1", "temperature", temperature);
    setInputValue(workflow, "1", "repetition_penalty", repetitionPenalty);
    setInputValue(workflow, "1", "min_p", minP);
    setInputValue(workflow, "1", "top_p", topP);
    setInputValue(workflow, "1", "seed", seed);
    setInputValue(workflow, "2", "audio", uploadResult.path ?? safeName);
    setInputValue(workflow, "2", "audioUI", `/api/userdata/${encodeURIComponent(uploadResult.path ?? safeName)}`);
    setInputValue(workflow, "3", "filename_prefix", filenamePrefix);

    const submitResult = await submitWorkflowToComfy(workflow, apiKey, getOptionalExtraData());

    return NextResponse.json({
      ok: true,
      promptId: submitResult.prompt_id,
      uploadedFile: uploadResult.path ?? safeName,
      workflowPath: "workflow/text-to-voice.json",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nieznany błąd serwera.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
