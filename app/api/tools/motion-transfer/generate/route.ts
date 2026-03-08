import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const COMFY_BASE_URL = "https://cloud.comfy.org";
const WORKFLOW_FILE_PATH = path.join(
  process.cwd(),
  "workflow",
  "video-to-video-reference.json"
);

const CONTROL_VIDEO_NODE_ID = "145";
const REFERENCE_IMAGE_NODE_ID = "134";
const POSITIVE_PROMPT_NODE_ID = "6";
const NEGATIVE_PROMPT_NODE_ID = "7";
const VACE_NODE_ID = "49";
const SAMPLER_NODE_ID = "3";
const CREATE_VIDEO_NODE_ID = "68";
const SAVE_VIDEO_NODE_ID = "114";

type WorkflowNode = {
  inputs?: Record<string, unknown>;
};

type WorkflowJson = Record<string, WorkflowNode>;

type UploadImageResponse = {
  name: string;
  subfolder?: string;
  type?: string;
};

function getApiKey() {
  const apiKey = process.env.COMFY_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error("Brakuje COMFY_CLOUD_API_KEY.");
  }
  return apiKey;
}

function toStringValue(value: FormDataEntryValue | null, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function toPositiveInt(value: FormDataEntryValue | null, fallback: number) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function setInputValue(
  workflow: WorkflowJson,
  nodeId: string,
  inputKey: string,
  value: unknown
) {
  const node = workflow[nodeId];
  if (!node?.inputs) {
    throw new Error(`Node ${nodeId} nie istnieje albo nie ma inputs.`);
  }
  node.inputs[inputKey] = value;
}

async function uploadImageToComfy(image: File, apiKey: string) {
  const formData = new FormData();
  formData.append("image", image);
  formData.append("type", "input");

  const response = await fetch(`${COMFY_BASE_URL}/api/upload/image`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
    },
    body: formData,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Upload image do Comfy Cloud nie powiódł się (${response.status}): ${text}`);
  }

  return JSON.parse(text) as UploadImageResponse;
}

async function uploadVideoToComfy(video: File, apiKey: string) {
  const safeName = `${Date.now()}-${video.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const buffer = await video.arrayBuffer();

  const response = await fetch(
    `${COMFY_BASE_URL}/api/userdata/${encodeURIComponent(safeName)}?overwrite=true`,
    {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/octet-stream",
      },
      body: buffer,
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Upload video do Comfy Cloud nie powiódł się (${response.status}): ${text}`);
  }

  return {
    name: safeName,
  };
}

async function loadWorkflowFromDisk() {
  const raw = await readFile(WORKFLOW_FILE_PATH, "utf-8");
  return JSON.parse(raw) as WorkflowJson;
}

async function submitWorkflowToComfy(workflow: WorkflowJson, apiKey: string) {
  const response = await fetch(`${COMFY_BASE_URL}/api/prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      prompt: workflow,
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Wysłanie workflow do Comfy Cloud nie powiodło się (${response.status}): ${text}`);
  }

  return JSON.parse(text) as { prompt_id: string };
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          ok: false,
          error: `Zły content-type. Oczekiwano multipart/form-data, przyszło: ${contentType || "(brak)"}`,
        },
        { status: 400 }
      );
    }

    const apiKey = getApiKey();
    const formData = await request.formData();

    const controlVideo = formData.get("controlVideo");
    const referenceImage = formData.get("referenceImage");

    if (!(controlVideo instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Nie przesłano pliku w polu 'controlVideo'." },
        { status: 400 }
      );
    }

    if (!(referenceImage instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Nie przesłano pliku w polu 'referenceImage'." },
        { status: 400 }
      );
    }

    const prompt = toStringValue(formData.get("prompt"));
    const negativePrompt = toStringValue(
      formData.get("negativePrompt"),
      "overexposed, static, blurry details, subtitles, ugly, deformed, fused fingers, still frame, messy background"
    );
    const width = toPositiveInt(formData.get("width"), 720);
    const height = toPositiveInt(formData.get("height"), 720);
    const length = toPositiveInt(formData.get("length"), 81);
    const fps = toPositiveInt(formData.get("fps"), 16);
    const seed = toPositiveInt(formData.get("seed"), 654654950714624);
    const steps = toPositiveInt(formData.get("steps"), 4);
    const cfg = toPositiveInt(formData.get("cfg"), 1);
    const filenamePrefix = toStringValue(formData.get("filenamePrefix"), "video/ComfyUI");

    const uploadedVideo = await uploadVideoToComfy(controlVideo, apiKey);
    const uploadedImage = await uploadImageToComfy(referenceImage, apiKey);

    const workflow = await loadWorkflowFromDisk();

    setInputValue(workflow, CONTROL_VIDEO_NODE_ID, "file", uploadedVideo.name);
    setInputValue(workflow, REFERENCE_IMAGE_NODE_ID, "image", uploadedImage.name);
    if (prompt) {
      setInputValue(workflow, POSITIVE_PROMPT_NODE_ID, "text", prompt);
    }
    setInputValue(workflow, NEGATIVE_PROMPT_NODE_ID, "text", negativePrompt);
    setInputValue(workflow, VACE_NODE_ID, "width", width);
    setInputValue(workflow, VACE_NODE_ID, "height", height);
    setInputValue(workflow, VACE_NODE_ID, "length", length);
    setInputValue(workflow, CREATE_VIDEO_NODE_ID, "fps", fps);
    setInputValue(workflow, SAMPLER_NODE_ID, "seed", seed);
    setInputValue(workflow, SAMPLER_NODE_ID, "steps", steps);
    setInputValue(workflow, SAMPLER_NODE_ID, "cfg", cfg);
    setInputValue(workflow, SAVE_VIDEO_NODE_ID, "filename_prefix", filenamePrefix);

    const submitResult = await submitWorkflowToComfy(workflow, apiKey);

    return NextResponse.json({
      ok: true,
      promptId: submitResult.prompt_id,
      uploadedControlVideo: uploadedVideo.name,
      uploadedReferenceImage: uploadedImage.name,
      workflowPath: "workflow/video-to-video-reference.json",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nieznany błąd serwera.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
