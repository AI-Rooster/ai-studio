import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const COMFY_BASE_URL = "https://cloud.comfy.org";
const WORKFLOW_FILE_PATH = path.join(
  process.cwd(),
  "workflow",
  "product-grid_nano.json"
);

const LOAD_PRODUCT_IMAGE_NODE_ID = "11";
const GRID_NODE_ID = "10";
const CROP_INSET_NODE_ID = "58";
const SELECT_IMAGE_NUMBER_NODE_ID = "91";
const UPSCALE_NODE_ID = "79";

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

    const productImage = formData.get("productImage");
    if (!(productImage instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Nie przesłano pliku w polu 'productImage'." },
        { status: 400 }
      );
    }

    const masterPrompt = toStringValue(formData.get("masterPrompt"), "");
    const gridSeed = toPositiveInt(formData.get("gridSeed"), 54320);
    const gridAspectRatio = toStringValue(formData.get("gridAspectRatio"), "auto");
    const gridResolution = toStringValue(formData.get("gridResolution"), "2K");
    const cropInset = toPositiveInt(formData.get("cropInset"), 0);
    const selectedImageNumber = toPositiveInt(formData.get("selectedImageNumber"), 1);

    const upscalePrompt = toStringValue(
      formData.get("upscalePrompt"),
      "Upscale image 1. Use the product from image 2 as a reference."
    );
    const upscaleSeed = toPositiveInt(formData.get("upscaleSeed"), 54321);
    const upscaleAspectRatio = toStringValue(formData.get("upscaleAspectRatio"), "auto");
    const upscaleResolution = toStringValue(formData.get("upscaleResolution"), "4K");

    const uploadResult = await uploadImageToComfy(productImage, apiKey);

    const workflow = await loadWorkflowFromDisk();

    setInputValue(workflow, LOAD_PRODUCT_IMAGE_NODE_ID, "image", uploadResult.name);

    if (masterPrompt) {
      setInputValue(workflow, GRID_NODE_ID, "prompt", masterPrompt);
    }
    setInputValue(workflow, GRID_NODE_ID, "seed", gridSeed);
    setInputValue(workflow, GRID_NODE_ID, "aspect_ratio", gridAspectRatio);
    setInputValue(workflow, GRID_NODE_ID, "resolution", gridResolution);

    setInputValue(workflow, CROP_INSET_NODE_ID, "value", cropInset);
    setInputValue(workflow, SELECT_IMAGE_NUMBER_NODE_ID, "value", selectedImageNumber);

    setInputValue(workflow, UPSCALE_NODE_ID, "prompt", upscalePrompt);
    setInputValue(workflow, UPSCALE_NODE_ID, "seed", upscaleSeed);
    setInputValue(workflow, UPSCALE_NODE_ID, "aspect_ratio", upscaleAspectRatio);
    setInputValue(workflow, UPSCALE_NODE_ID, "resolution", upscaleResolution);

    const submitResponse = await fetch(`${COMFY_BASE_URL}/api/prompt`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
  },
  body: JSON.stringify({
    prompt: workflow,
    extra_data: {
      api_key_comfy_org: apiKey,
    },
  }),
});

    const submitText = await submitResponse.text();

    if (!submitResponse.ok) {
      throw new Error(`Wysłanie workflow do Comfy Cloud nie powiodło się (${submitResponse.status}): ${submitText}`);
    }

    const submitResult = JSON.parse(submitText) as { prompt_id: string };

    return NextResponse.json({
      ok: true,
      promptId: submitResult.prompt_id,
      uploadedFile: uploadResult.name,
      workflowPath: "workflow/product-grid_nano.json",
      premium: true,
      extraCredits: true,
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
