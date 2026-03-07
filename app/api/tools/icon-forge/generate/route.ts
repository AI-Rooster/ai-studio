import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const COMFY_BASE_URL = "https://cloud.comfy.org";
const WORKFLOW_FILE_PATH = path.join(
  process.cwd(),
  "workflow",
  "icon-forge.json"
);

const REFERENCE_IMAGE_NODE_ID = "1";
const BRAND_DESCRIPTION_NODE_ID = "39";
const GENERATE_NODE_ID = "3";
const GRID_SAVE_NODE_ID = "7";
const ICON_SAVE_NODE_IDS = ["8", "9", "10", "11", "12", "13", "14", "24", "25"];

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

function toStringValue(value: FormDataEntryValue | null, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function toSeedValue(value: FormDataEntryValue | null, fallback = 12345) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function injectReferenceImage(workflow: WorkflowJson, uploadedFilename: string) {
  setInputValue(workflow, REFERENCE_IMAGE_NODE_ID, "image", uploadedFilename);
}

function injectTextContent(
  workflow: WorkflowJson,
  brandDescription: string,
  additionalInstructions: string
) {
  const combinedDescription = additionalInstructions
    ? `${brandDescription}\n\nAdditional stylistic instructions:\n${additionalInstructions}`
    : brandDescription;

  setInputValue(workflow, BRAND_DESCRIPTION_NODE_ID, "value", combinedDescription);
}

function injectGenerationOptions(
  workflow: WorkflowJson,
  seed: number,
  resolution: string,
  aspectRatio: string
) {
  setInputValue(workflow, GENERATE_NODE_ID, "seed", seed);
  setInputValue(workflow, GENERATE_NODE_ID, "resolution", resolution);
  setInputValue(workflow, GENERATE_NODE_ID, "aspect_ratio", aspectRatio);
}

function injectFilenamePrefixes(workflow: WorkflowJson, filenamePrefixBase: string) {
  const base = filenamePrefixBase || "ComfyUI";

  setInputValue(workflow, GRID_SAVE_NODE_ID, "filename_prefix", `${base}-3x3_grid_icons`);

  ICON_SAVE_NODE_IDS.forEach((nodeId, index) => {
    setInputValue(workflow, nodeId, "filename_prefix", `${base}-icon_${index + 1}`);
  });
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

    const referenceImage = formData.get("referenceImage");

    if (!(referenceImage instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Nie przesłano obrazu referencyjnego." },
        { status: 400 }
      );
    }

    const brandDescription = toStringValue(formData.get("brandDescription"), "");
    const additionalInstructions = toStringValue(formData.get("additionalInstructions"), "");
    const resolution = toStringValue(formData.get("resolution"), "4K");
    const aspectRatio = toStringValue(formData.get("aspectRatio"), "1:1");
    const filenamePrefixBase = toStringValue(formData.get("filenamePrefixBase"), "ComfyUI");
    const seed = toSeedValue(formData.get("seed"), 12345);

    if (!brandDescription) {
      return NextResponse.json(
        { ok: false, error: "Podaj opis marki / kontekstu." },
        { status: 400 }
      );
    }

    const uploadResult = await uploadImageToComfy(referenceImage, apiKey);

    const workflow = await loadWorkflowFromDisk();
    injectReferenceImage(workflow, uploadResult.name);
    injectTextContent(workflow, brandDescription, additionalInstructions);
    injectGenerationOptions(workflow, seed, resolution, aspectRatio);
    injectFilenamePrefixes(workflow, filenamePrefixBase);

    const submitResult = await submitWorkflowToComfy(workflow, apiKey);

    return NextResponse.json({
      ok: true,
      promptId: submitResult.prompt_id,
      uploadedFile: uploadResult.name,
      workflowPath: "workflow/icon-forge.json",
      premiumTool: true,
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
