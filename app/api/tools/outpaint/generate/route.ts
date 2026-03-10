import { NextResponse } from "next/server";
import {
  getComfyApiKey,
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

    const prompt = toStringValue(formData.get("prompt"), "beautiful scenery");
    const seed = toNumberValue(formData.get("seed"), 164211176398261);
    const steps = toNumberValue(formData.get("steps"), 20);
    const guidance = toNumberValue(formData.get("guidance"), 30);
    const left = toNumberValue(formData.get("left"), 400);
    const top = toNumberValue(formData.get("top"), 0);
    const right = toNumberValue(formData.get("right"), 400);
    const bottom = toNumberValue(formData.get("bottom"), 400);
    const feathering = toNumberValue(formData.get("feathering"), 40);
    const filenamePrefix = toStringValue(formData.get("filenamePrefix"), "ComfyUI");

    const uploadResult = await uploadImageToComfy(image, apiKey);
    const workflow = await loadWorkflowFromDisk("outpaint.json");

    setInputValue(workflow, "17", "image", uploadResult.name);
    setInputValue(workflow, "23", "text", prompt);
    setInputValue(workflow, "3", "seed", seed);
    setInputValue(workflow, "3", "steps", steps);
    setInputValue(workflow, "26", "guidance", guidance);
    setInputValue(workflow, "44", "left", left);
    setInputValue(workflow, "44", "top", top);
    setInputValue(workflow, "44", "right", right);
    setInputValue(workflow, "44", "bottom", bottom);
    setInputValue(workflow, "44", "feathering", feathering);
    setInputValue(workflow, "9", "filename_prefix", filenamePrefix);

    const submitResult = await submitWorkflowToComfy(workflow, apiKey);

    return NextResponse.json({
      ok: true,
      promptId: submitResult.prompt_id,
      uploadedFile: uploadResult.name,
      workflowPath: "workflow/outpaint.json",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nieznany błąd serwera.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
