import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const COMFY_BASE_URL = "https://cloud.comfy.org";
const WORKFLOW_FILE_PATH = path.join(
  process.cwd(),
  "workflow",
  "image-to-video.json"
);

const LOAD_IMAGE_NODE_ID = "98";
const PROMPT_NODE_ID = "167:164";
const RESIZE_NODE_ID = "167:102";
const LENGTH_NODE_ID = "167:146";
const CONDITIONING_NODE_ID = "167:133";
const AUDIO_LATENT_NODE_ID = "167:132";
const CREATE_VIDEO_NODE_ID = "167:136";
const SAVE_VIDEO_NODE_ID = "75";
const NOISE_NODE_IDS = ["167:165", "167:135"];
const SCHEDULER_NODE_ID = "167:127";
const LONGER_EDGE_NODE_ID = "167:158";

type WorkflowNode = {
  inputs?: Record<string, unknown>;
};

type WorkflowJson = Record<string, WorkflowNode>;

type UploadResponse = {
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

async function uploadImageToComfy(image: File, apiKey: string) {
  const formData = new FormData();
  formData.append("image", image);
  formData.append("type", "input");
  formData.append("overwrite", "true");

  const response = await fetch(`${COMFY_BASE_URL}/api/upload/image`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
    },
    body: formData,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Upload do Comfy Cloud nie powiódł się (${response.status}): ${text}`);
  }

  return JSON.parse(text) as UploadResponse;
}

async function loadWorkflowFromDisk() {
  const raw = await readFile(WORKFLOW_FILE_PATH, "utf-8");
  return JSON.parse(raw) as WorkflowJson;
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

    const image = formData.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Nie przesłano pliku w polu 'image'." },
        { status: 400 }
      );
    }

    const prompt = toStringValue(formData.get("prompt"), "");
    const promptSeed = toPositiveInt(formData.get("promptSeed"), 0);
    const width = toPositiveInt(formData.get("width"), 1280);
    const height = toPositiveInt(formData.get("height"), 720);
    const length = toPositiveInt(formData.get("length"), 121);
    const frameRate = toPositiveInt(formData.get("frameRate"), 25);
    const outputFps = toPositiveInt(formData.get("outputFps"), 24);
    const noiseSeed = toPositiveInt(formData.get("noiseSeed"), 10);
    const steps = toPositiveInt(formData.get("steps"), 20);
    const longerEdge = toPositiveInt(formData.get("longerEdge"), 1536);
    const filenamePrefix = toStringValue(formData.get("filenamePrefix"), "video/LTX_2.3_i2v");

    const uploadResult = await uploadImageToComfy(image, apiKey);
    const workflow = await loadWorkflowFromDisk();

    setInputValue(workflow, LOAD_IMAGE_NODE_ID, "image", uploadResult.name);

    if (prompt) {
      setInputValue(workflow, PROMPT_NODE_ID, "prompt", prompt);
    }

    setInputValue(workflow, PROMPT_NODE_ID, "sampling_mode.seed", promptSeed);
    setInputValue(workflow, RESIZE_NODE_ID, "resize_type.width", width);
    setInputValue(workflow, RESIZE_NODE_ID, "resize_type.height", height);
    setInputValue(workflow, LENGTH_NODE_ID, "value", length);
    setInputValue(workflow, CONDITIONING_NODE_ID, "frame_rate", frameRate);
    setInputValue(workflow, AUDIO_LATENT_NODE_ID, "frame_rate", frameRate);
    setInputValue(workflow, CREATE_VIDEO_NODE_ID, "fps", outputFps);
    setInputValue(workflow, SCHEDULER_NODE_ID, "steps", steps);
    setInputValue(workflow, LONGER_EDGE_NODE_ID, "longer_edge", longerEdge);
    setInputValue(workflow, SAVE_VIDEO_NODE_ID, "filename_prefix", filenamePrefix);

    for (const nodeId of NOISE_NODE_IDS) {
      setInputValue(workflow, nodeId, "noise_seed", noiseSeed);
    }

    const submitResult = await submitWorkflowToComfy(workflow, apiKey);

    return NextResponse.json({
      ok: true,
      promptId: submitResult.prompt_id,
      uploadedFile: uploadResult.name,
      workflowPath: "workflow/image-to-video.json",
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
