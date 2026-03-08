import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const COMFY_BASE_URL = "https://cloud.comfy.org";
const WORKFLOW_FILE_PATH = path.join(
  process.cwd(),
  "workflow",
  "text-to-video.json"
);

const SAVE_VIDEO_NODE_ID = "75";
const SCHEDULER_NODE_ID = "153:112";
const NEGATIVE_PROMPT_NODE_ID = "153:123";
const LENGTH_NODE_ID = "153:125";
const MAIN_NOISE_NODE_ID = "153:127";
const FRAME_RATE_FLOAT_NODE_ID = "153:140";
const FRAME_RATE_INT_NODE_ID = "153:141";
const PROMPT_GENERATOR_NODE_ID = "153:149";
const UPSCALE_NOISE_NODE_ID = "153:151";
const EMPTY_IMAGE_NODE_ID = "153:124";
const CFG_NODE_ID = "153:139";

type WorkflowNode = {
  inputs?: Record<string, unknown>;
};

type WorkflowJson = Record<string, WorkflowNode>;

type GeneratePayload = {
  prompt?: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  length?: number;
  fps?: number;
  steps?: number;
  cfg?: number;
  promptSeed?: number;
  noiseSeed?: number;
  filenamePrefix?: string;
};

function getApiKey() {
  const apiKey = process.env.COMFY_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error("Brakuje COMFY_CLOUD_API_KEY.");
  }
  return apiKey;
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

function toPositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function toPositiveFloat(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toStringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
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
    throw new Error(
      `Wysłanie workflow do Comfy Cloud nie powiodło się (${response.status}): ${text}`
    );
  }

  return JSON.parse(text) as { prompt_id: string };
}

export async function POST(request: Request) {
  try {
    const apiKey = getApiKey();
    const payload = (await request.json()) as GeneratePayload;

    const prompt = toStringValue(
      payload.prompt,
      'A close-up cinematic shot of futuristic mechanical parts assembling in midair like a high-tech machine building itself, tiny screws, gears and panels snapping into place, sparks and glowing lights, extremely detailed metal textures. The final assembled device has a clean, unobstructed flat surface with glowing engraved text clearly displaying "LTX-2.3", text is large, legible, centered, highly visible and not covered by any parts, dramatic studio lighting, ultra realistic, 8K, sharp focus, cinematic detail'
    );
    const negativePrompt = toStringValue(
      payload.negativePrompt,
      "blurry, low quality, still frame, frames, watermark, overlay, titles, has blurbox, has subtitles"
    );
    const width = toPositiveInt(payload.width, 1280);
    const height = toPositiveInt(payload.height, 720);
    const length = toPositiveInt(payload.length, 121);
    const fps = toPositiveInt(payload.fps, 24);
    const steps = toPositiveInt(payload.steps, 20);
    const cfg = toPositiveFloat(payload.cfg, 4);
    const promptSeed = toPositiveInt(payload.promptSeed, 0);
    const noiseSeed = toPositiveInt(payload.noiseSeed, 0);
    const filenamePrefix = toStringValue(payload.filenamePrefix, "video/LTX-2.3");

    const workflow = await loadWorkflowFromDisk();

    setInputValue(workflow, SAVE_VIDEO_NODE_ID, "filename_prefix", filenamePrefix);
    setInputValue(workflow, SCHEDULER_NODE_ID, "steps", steps);
    setInputValue(workflow, NEGATIVE_PROMPT_NODE_ID, "text", negativePrompt);
    setInputValue(workflow, LENGTH_NODE_ID, "value", length);
    setInputValue(workflow, MAIN_NOISE_NODE_ID, "noise_seed", noiseSeed);
    setInputValue(workflow, UPSCALE_NOISE_NODE_ID, "noise_seed", noiseSeed);
    setInputValue(workflow, FRAME_RATE_FLOAT_NODE_ID, "value", fps);
    setInputValue(workflow, FRAME_RATE_INT_NODE_ID, "value", fps);
    setInputValue(workflow, PROMPT_GENERATOR_NODE_ID, "prompt", prompt);
    setInputValue(workflow, PROMPT_GENERATOR_NODE_ID, "sampling_mode.seed", promptSeed);
    setInputValue(workflow, EMPTY_IMAGE_NODE_ID, "width", width);
    setInputValue(workflow, EMPTY_IMAGE_NODE_ID, "height", height);
    setInputValue(workflow, CFG_NODE_ID, "cfg", cfg);

    const submitResult = await submitWorkflowToComfy(workflow, apiKey);

    return NextResponse.json({
      ok: true,
      promptId: submitResult.prompt_id,
      workflowPath: "workflow/text-to-video.json",
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
