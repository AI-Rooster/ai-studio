import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const COMFY_BASE_URL = "https://cloud.comfy.org";
const WORKFLOW_FILE_PATH = path.join(
  process.cwd(),
  "workflow",
  "six-frame-video.json"
);

const LOAD_IMAGE_NODE_IDS = ["62", "122", "124", "126", "128", "130"];
const WAN_NODE_IDS = ["140:67", "141:159", "142:175", "143:191", "144:207"];
const POSITIVE_PROMPT_NODE_IDS = ["140:6", "141:160", "142:176", "143:192", "144:208"];
const NEGATIVE_PROMPT_NODE_IDS = ["140:7", "141:148", "142:164", "143:180", "144:196"];
const CREATE_VIDEO_NODE_IDS = ["145", "140:60", "141:149", "142:165", "143:181", "144:197"];
const SAVE_VIDEO_NODE_ID = "146";

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

function toPositiveInt(value: FormDataEntryValue | null, fallback: number) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toStringValue(value: FormDataEntryValue | null, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
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

function injectFrames(
  workflow: WorkflowJson,
  uploadedFiles: string[]
) {
  LOAD_IMAGE_NODE_IDS.forEach((nodeId, index) => {
    setInputValue(workflow, nodeId, "image", uploadedFiles[index]);
  });
}

function injectPrompts(
  workflow: WorkflowJson,
  prompt: string,
  negativePrompt: string
) {
  POSITIVE_PROMPT_NODE_IDS.forEach((nodeId, index) => {
    // pierwszy node ma już domyślnie prompt, ale też go nadpisujemy
    setInputValue(workflow, nodeId, "text", prompt || (index === 0 ? "cat turn around" : ""));
  });

  NEGATIVE_PROMPT_NODE_IDS.forEach((nodeId) => {
    if (negativePrompt) {
      setInputValue(workflow, nodeId, "text", negativePrompt);
    }
  });
}

function injectVideoSettings(
  workflow: WorkflowJson,
  width: number,
  height: number,
  segmentLength: number,
  fps: number,
  filenamePrefix: string
) {
  WAN_NODE_IDS.forEach((nodeId) => {
    setInputValue(workflow, nodeId, "width", width);
    setInputValue(workflow, nodeId, "height", height);
    setInputValue(workflow, nodeId, "length", segmentLength);
  });

  CREATE_VIDEO_NODE_IDS.forEach((nodeId) => {
    setInputValue(workflow, nodeId, "fps", fps);
  });

  setInputValue(workflow, SAVE_VIDEO_NODE_ID, "filename_prefix", filenamePrefix);
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

    const frames = formData
      .getAll("frames")
      .filter((entry): entry is File => entry instanceof File);

    if (frames.length !== 6) {
      return NextResponse.json(
        { ok: false, error: `Musisz przesłać dokładnie 6 obrazów. Otrzymano: ${frames.length}` },
        { status: 400 }
      );
    }

    const prompt = toStringValue(formData.get("prompt"), "");
    const negativePrompt = toStringValue(formData.get("negativePrompt"), "");
    const width = toPositiveInt(formData.get("width"), 720);
    const height = toPositiveInt(formData.get("height"), 720);
    const segmentLength = toPositiveInt(formData.get("segmentLength"), 25);
    const fps = toPositiveInt(formData.get("fps"), 24);
    const filenamePrefix = toStringValue(formData.get("filenamePrefix"), "video/ComfyUI");

    const uploadedFiles: string[] = [];

    for (const frame of frames) {
      const uploadResult = await uploadImageToComfy(frame, apiKey);
      uploadedFiles.push(uploadResult.name);
    }

    const workflow = await loadWorkflowFromDisk();

    injectFrames(workflow, uploadedFiles);
    injectPrompts(workflow, prompt, negativePrompt);
    injectVideoSettings(workflow, width, height, segmentLength, fps, filenamePrefix);

    const submitResult = await submitWorkflowToComfy(workflow, apiKey);

    return NextResponse.json({
      ok: true,
      promptId: submitResult.prompt_id,
      uploadedFiles,
      workflowPath: "workflow/six-frame-video.json",
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