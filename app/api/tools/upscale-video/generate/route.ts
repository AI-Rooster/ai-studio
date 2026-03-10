import { NextResponse } from "next/server";
import {
  getComfyApiKey,
  loadWorkflowFromDisk,
  setInputValue,
  submitWorkflowToComfy,
  uploadUserDataFile,
} from "@/lib/comfy/cloud";

export const runtime = "nodejs";

function toStringValue(value: FormDataEntryValue | null, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ ok: false, error: `Zły content-type: ${contentType || "(brak)"}` }, { status: 400 });
    }

    const apiKey = getComfyApiKey();
    const formData = await request.formData();
    const video = formData.get("video");

    if (!(video instanceof File)) {
      return NextResponse.json({ ok: false, error: "Nie przesłano pliku wideo." }, { status: 400 });
    }

    const filenamePrefix = toStringValue(formData.get("filenamePrefix"), "video/ComfyUI");
    const safeName = video.name.replace(/\s+/g, "-");
    const uploadResult = await uploadUserDataFile(video, apiKey, safeName);

    const workflow = await loadWorkflowFromDisk("upscale-video.json");
    setInputValue(workflow, "9", "file", uploadResult.path ?? safeName);
    setInputValue(workflow, "12", "filename_prefix", filenamePrefix);

    const submitResult = await submitWorkflowToComfy(workflow, apiKey);

    return NextResponse.json({
      ok: true,
      promptId: submitResult.prompt_id,
      uploadedFile: uploadResult.path ?? safeName,
      workflowPath: "workflow/upscale-video.json",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nieznany błąd serwera.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
