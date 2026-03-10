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

    const prompt = toStringValue(formData.get("prompt"), "Write three social media ad hooks for a product launch.");
    const maxLength = toNumberValue(formData.get("maxLength"), 2048);
    const temperature = toNumberValue(formData.get("temperature"), 0.7);
    const topK = toNumberValue(formData.get("topK"), 64);
    const topP = toNumberValue(formData.get("topP"), 0.95);
    const minP = toNumberValue(formData.get("minP"), 0.05);
    const repetitionPenalty = toNumberValue(formData.get("repetitionPenalty"), 1.05);
    const seed = toNumberValue(formData.get("seed"), 0);

    const workflow = await loadWorkflowFromDisk("copywriter.json");
    setInputValue(workflow, "7", "prompt", prompt);
    setInputValue(workflow, "7", "max_length", maxLength);
    setInputValue(workflow, "7", "sampling_mode.temperature", temperature);
    setInputValue(workflow, "7", "sampling_mode.top_k", topK);
    setInputValue(workflow, "7", "sampling_mode.top_p", topP);
    setInputValue(workflow, "7", "sampling_mode.min_p", minP);
    setInputValue(workflow, "7", "sampling_mode.repetition_penalty", repetitionPenalty);
    setInputValue(workflow, "7", "sampling_mode.seed", seed);

    const submitResult = await submitWorkflowToComfy(workflow, apiKey, getOptionalExtraData());

    return NextResponse.json({
      ok: true,
      promptId: submitResult.prompt_id,
      workflowPath: "workflow/copywriter.json",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nieznany błąd serwera.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
