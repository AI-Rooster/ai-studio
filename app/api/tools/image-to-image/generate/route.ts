import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const COMFY_BASE_URL = "https://cloud.comfy.org";
const WORKFLOW_FILE_PATH = path.join(
  process.cwd(),
  "workflow",
  "image-to-image.json"
);

const LOAD_IMAGE_NODE_ID = "46";
const PROMPT_NODE_ID = "68:6";
const SEED_NODE_ID = "68:25";
const GUIDANCE_NODE_ID = "68:26";
const TURBO_NODE_ID = "68:94";
const FILENAME_PREFIX_NODE_ID = "9";
const MEGAPIXELS_NODE_ID = "45";

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

function toNumberValue(value: FormDataEntryValue | null, fallback: number) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBooleanValue(value: FormDataEntryValue | null, fallback = false) {
  if (typeof value !== "string") return fallback;
  return value === "true" || value === "on" || value === "1";
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
    const seed = toNumberValue(formData.get("seed"), 649422536169327);
    const guidance = toNumberValue(formData.get("guidance"), 4);
    const megapixels = toNumberValue(formData.get("megapixels"), 1);
    const turboMode = toBooleanValue(formData.get("turboMode"), false);
    const filenamePrefix = toStringValue(formData.get("filenamePrefix"), "Flux2");

    const uploadResult = await uploadImageToComfy(image, apiKey);
    const workflow = await loadWorkflowFromDisk();

    setInputValue(workflow, LOAD_IMAGE_NODE_ID, "image", uploadResult.name);

    if (prompt) {
      setInputValue(workflow, PROMPT_NODE_ID, "text", prompt);
    }

    setInputValue(workflow, SEED_NODE_ID, "noise_seed", seed);
    setInputValue(workflow, GUIDANCE_NODE_ID, "guidance", guidance);
    setInputValue(workflow, TURBO_NODE_ID, "value", turboMode);
    setInputValue(workflow, FILENAME_PREFIX_NODE_ID, "filename_prefix", filenamePrefix);
    setInputValue(workflow, MEGAPIXELS_NODE_ID, "megapixels", megapixels);

    const submitResult = await submitWorkflowToComfy(workflow, apiKey);

    return NextResponse.json({
      ok: true,
      promptId: submitResult.prompt_id,
      uploadedFile: uploadResult.name,
      workflowPath: "workflow/image-to-image.json",
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