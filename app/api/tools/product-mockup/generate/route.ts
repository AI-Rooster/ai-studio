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
    const designImage = formData.get("designImage");
    const targetImage = formData.get("targetImage");

    if (!(designImage instanceof File) || !(targetImage instanceof File)) {
      return NextResponse.json({ ok: false, error: "Prześlij design image i target image." }, { status: 400 });
    }

    const prompt = toStringValue(formData.get("prompt"), "Apply the design from Reference Image 1 onto objects in Reference Image 2.");
    const seed = toNumberValue(formData.get("seed"), 120839687766682);
    const megapixels = toNumberValue(formData.get("megapixels"), 1);
    const standardSteps = toNumberValue(formData.get("standardSteps"), 20);
    const turboSteps = toNumberValue(formData.get("turboSteps"), 8);
    const filenamePrefix = toStringValue(formData.get("filenamePrefix"), "Flux2");

    const [designUpload, targetUpload] = await Promise.all([
      uploadImageToComfy(designImage, apiKey),
      uploadImageToComfy(targetImage, apiKey),
    ]);

    const workflow = await loadWorkflowFromDisk("product-mockup.json");
    setInputValue(workflow, "42", "image", designUpload.name);
    setInputValue(workflow, "46", "image", targetUpload.name);

    setInputValue(workflow, "62:6", "text", prompt);
    setInputValue(workflow, "63:80", "text", prompt);

    setInputValue(workflow, "62:25", "noise_seed", seed);
    setInputValue(workflow, "63:81", "noise_seed", seed);

    setInputValue(workflow, "62:41", "megapixels", megapixels);
    setInputValue(workflow, "62:45", "megapixels", megapixels);
    setInputValue(workflow, "63:72", "megapixels", megapixels);
    setInputValue(workflow, "63:85", "megapixels", megapixels);

    setInputValue(workflow, "62:48", "steps", standardSteps);
    setInputValue(workflow, "63:84", "steps", turboSteps);

    setInputValue(workflow, "9", "filename_prefix", `${filenamePrefix}-standard`);
    setInputValue(workflow, "64", "filename_prefix", `${filenamePrefix}-turbo`);

    const submitResult = await submitWorkflowToComfy(workflow, apiKey, getOptionalExtraData());

    return NextResponse.json({
      ok: true,
      promptId: submitResult.prompt_id,
      uploadedFiles: [designUpload.name ?? "", targetUpload.name ?? ""],
      workflowPath: "workflow/product-mockup.json",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nieznany błąd serwera.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
