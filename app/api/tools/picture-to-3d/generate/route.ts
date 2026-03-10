import { NextResponse } from "next/server";
import {
  getComfyApiKey,
  getOptionalExtraData,
  loadWorkflowFromDisk,
  setInputValue,
  submitWorkflowToComfy,
  uploadImageToComfy,
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
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ ok: false, error: "Nie przesłano obrazu wejściowego." }, { status: 400 });
    }

    const resolution = toNumberValue(formData.get("resolution"), 4096);
    const seed = toNumberValue(formData.get("seed"), 952805179515179);
    const steps = toNumberValue(formData.get("steps"), 30);
    const cfg = toNumberValue(formData.get("cfg"), 5);
    const shift = toNumberValue(formData.get("shift"), 1);
    const threshold = toNumberValue(formData.get("threshold"), 0.6);
    const filenamePrefix = toStringValue(formData.get("filenamePrefix"), "mesh/ComfyUI");

    const uploadResult = await uploadImageToComfy(image, apiKey);
    const workflow = await loadWorkflowFromDisk("picture-to-3d.json");

    setInputValue(workflow, "2", "image", uploadResult.name);
    setInputValue(workflow, "4", "resolution", resolution);
    setInputValue(workflow, "7", "seed", seed);
    setInputValue(workflow, "7", "steps", steps);
    setInputValue(workflow, "7", "cfg", cfg);
    setInputValue(workflow, "3", "shift", shift);
    setInputValue(workflow, "9", "threshold", threshold);
    setInputValue(workflow, "10", "filename_prefix", filenamePrefix);

    const submitResult = await submitWorkflowToComfy(workflow, apiKey, getOptionalExtraData());

    return NextResponse.json({
      ok: true,
      promptId: submitResult.prompt_id,
      uploadedFile: uploadResult.name,
      workflowPath: "workflow/picture-to-3d.json",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nieznany błąd serwera.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
