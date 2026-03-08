import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const COMFY_BASE_URL = "https://cloud.comfy.org";
const WORKFLOW_FILE_PATH = path.join(
  process.cwd(),
  "workflow",
  "material-change.json"
);

const PRODUCT_IMAGE_NODE_ID = "41";
const MATERIAL_IMAGE_NODE_ID = "83";
const POSITIVE_PROMPT_NODE_ID = "143:126";
const SEED_NODE_ID = "143:128";
const FAST_MODE_NODE_ID = "143:138";
const SAVE_IMAGE_NODE_ID = "9";

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

function toBooleanValue(value: FormDataEntryValue | null, fallback = false) {
  if (typeof value !== "string") return fallback;
  return value === "true" || value === "1" || value.toLowerCase() === "on";
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
    const materialImage = formData.get("materialImage");

    if (!(productImage instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Nie przesłano pliku w polu 'productImage'." },
        { status: 400 }
      );
    }

    if (!(materialImage instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Nie przesłano pliku w polu 'materialImage'." },
        { status: 400 }
      );
    }

    const prompt = toStringValue(
      formData.get("prompt"),
      "Change the material in image 1 to match image 2 while preserving the product shape, proportions, lighting and composition."
    );
    const seed = toPositiveInt(formData.get("seed"), 3787899710385);
    const fastMode = toBooleanValue(formData.get("fastMode"), false);
    const filenamePrefix = toStringValue(formData.get("filenamePrefix"), "Material_Change");

    const uploadedProduct = await uploadImageToComfy(productImage, apiKey);
    const uploadedMaterial = await uploadImageToComfy(materialImage, apiKey);

    const workflow = await loadWorkflowFromDisk();

    setInputValue(workflow, PRODUCT_IMAGE_NODE_ID, "image", uploadedProduct.name);
    setInputValue(workflow, MATERIAL_IMAGE_NODE_ID, "image", uploadedMaterial.name);
    setInputValue(workflow, POSITIVE_PROMPT_NODE_ID, "prompt", prompt);
    setInputValue(workflow, SEED_NODE_ID, "seed", seed);
    setInputValue(workflow, FAST_MODE_NODE_ID, "value", fastMode);
    setInputValue(workflow, SAVE_IMAGE_NODE_ID, "filename_prefix", filenamePrefix);

    const submitResponse = await fetch(`${COMFY_BASE_URL}/api/prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        prompt: workflow,
      }),
    });

    const submitText = await submitResponse.text();

    if (!submitResponse.ok) {
      throw new Error(
        `Wysłanie workflow do Comfy Cloud nie powiodło się (${submitResponse.status}): ${submitText}`
      );
    }

    const submitResult = JSON.parse(submitText) as { prompt_id: string };

    return NextResponse.json({
      ok: true,
      promptId: submitResult.prompt_id,
      uploadedFiles: [uploadedProduct.name, uploadedMaterial.name],
      workflowPath: "workflow/material-change.json",
      premium: false,
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
