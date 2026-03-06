import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const COMFY_BASE_URL = "https://cloud.comfy.org";
const WORKFLOW_FILE_PATH = path.join(
  process.cwd(),
  "workflow",
  "image-workflow.json"
);
const LOAD_IMAGE_NODE_ID = "25";

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
    throw new Error("Brakuje COMFY_CLOUD_API_KEY w zmiennych środowiskowych.");
  }
  return apiKey;
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

function injectUploadedImageIntoWorkflow(
  workflow: WorkflowJson,
  uploadedFileName: string
) {
  const node = workflow[LOAD_IMAGE_NODE_ID];

  if (!node?.inputs) {
    throw new Error(
      `Nie znaleziono node ${LOAD_IMAGE_NODE_ID} w workflow albo node nie ma inputs.`
    );
  }

  if (!("image" in node.inputs)) {
    throw new Error(
      `Node ${LOAD_IMAGE_NODE_ID} nie ma pola inputs.image.`
    );
  }

  node.inputs.image = uploadedFileName;
  return workflow;
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
    const apiKey = getApiKey();

    const incomingFormData = await request.formData();
    const image = incomingFormData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "Nie przesłano pliku w polu 'image'." },
        { status: 400 }
      );
    }

    const uploadResult = await uploadImageToComfy(image, apiKey);

    let workflow = await loadWorkflowFromDisk();
    workflow = injectUploadedImageIntoWorkflow(workflow, uploadResult.name);

    const submitResult = await submitWorkflowToComfy(workflow, apiKey);

    return NextResponse.json({
      ok: true,
      promptId: submitResult.prompt_id,
      uploadedFile: uploadResult.name,
      workflowPath: "workflow/image-workflow.json",
      loadImageNodeId: LOAD_IMAGE_NODE_ID,
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