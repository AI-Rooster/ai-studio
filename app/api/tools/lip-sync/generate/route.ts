import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const COMFY_BASE_URL = "https://cloud.comfy.org";
const WORKFLOW_FILE_PATH = path.join(process.cwd(), "workflow", "lip-sync.json");

const AUDIO_NODE_ID = "125";
const IMAGE_NODE_ID = "284";
const SAVE_VIDEO_NODE_ID = "325";
const TEXT_NODE_ID = "330:332";
const RESIZE_NODE_ID = "330:340";
const AUDIO_EMBEDS_NODE_ID = "330:337";
const SAMPLER_NODE_ID = "330:333";
const CREATE_VIDEO_NODE_ID = "330:334";

type WorkflowNode = {
  inputs?: Record<string, unknown>;
};

type WorkflowJson = Record<string, WorkflowNode>;

type UploadImageResponse = {
  name: string;
  subfolder?: string;
  type?: string;
};

type UploadUserDataResponse = {
  path: string;
  size?: number;
  modified?: string;
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

function toNumber(value: FormDataEntryValue | null, fallback: number) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
    throw new Error(`Upload obrazu do Comfy Cloud nie powiódł się (${response.status}): ${text}`);
  }

  return JSON.parse(text) as UploadImageResponse;
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function uploadAudioToComfy(audio: File, apiKey: string) {
  const safeName = sanitizeFilename(audio.name || "input_audio.mp3");
  const response = await fetch(
    `${COMFY_BASE_URL}/api/userdata/${encodeURIComponent(safeName)}?overwrite=true&full_info=true`,
    {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/octet-stream",
      },
      body: Buffer.from(await audio.arrayBuffer()),
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Upload audio do Comfy Cloud nie powiódł się (${response.status}): ${text}`);
  }

  const data = JSON.parse(text) as UploadUserDataResponse;
  return { path: data.path || safeName, safeName };
}

async function loadWorkflowFromDisk() {
  const raw = await readFile(WORKFLOW_FILE_PATH, "utf-8");
  return JSON.parse(raw) as WorkflowJson;
}

function setInputValue(workflow: WorkflowJson, nodeId: string, inputKey: string, value: unknown) {
  const node = workflow[nodeId];
  if (!node?.inputs) {
    throw new Error(`Node ${nodeId} nie istnieje albo nie ma inputs.`);
  }
  node.inputs[inputKey] = value;
}

function injectInputs(
  workflow: WorkflowJson,
  options: {
    imageName: string;
    audioPath: string;
    positivePrompt: string;
    negativePrompt: string;
    width: number;
    height: number;
    fps: number;
    numFrames: number;
    seed: number;
    steps: number;
    cfg: number;
    shift: number;
    filenamePrefix: string;
  }
) {
  setInputValue(workflow, IMAGE_NODE_ID, "image", options.imageName);

  setInputValue(workflow, AUDIO_NODE_ID, "audio", options.audioPath);
  setInputValue(
    workflow,
    AUDIO_NODE_ID,
    "audioUI",
    `/api/userdata/${encodeURIComponent(options.audioPath)}`
  );

  setInputValue(workflow, TEXT_NODE_ID, "positive_prompt", options.positivePrompt);
  setInputValue(workflow, TEXT_NODE_ID, "negative_prompt", options.negativePrompt);

  setInputValue(workflow, RESIZE_NODE_ID, "width", options.width);
  setInputValue(workflow, RESIZE_NODE_ID, "height", options.height);

  setInputValue(workflow, AUDIO_EMBEDS_NODE_ID, "num_frames", options.numFrames);
  setInputValue(workflow, AUDIO_EMBEDS_NODE_ID, "fps", options.fps);

  setInputValue(workflow, SAMPLER_NODE_ID, "seed", options.seed);
  setInputValue(workflow, SAMPLER_NODE_ID, "steps", options.steps);
  setInputValue(workflow, SAMPLER_NODE_ID, "cfg", options.cfg);
  setInputValue(workflow, SAMPLER_NODE_ID, "shift", options.shift);

  setInputValue(workflow, CREATE_VIDEO_NODE_ID, "fps", options.fps);
  setInputValue(workflow, SAVE_VIDEO_NODE_ID, "filename_prefix", options.filenamePrefix);
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
    const audio = formData.get("audio");

    if (!(image instanceof File)) {
      return NextResponse.json({ ok: false, error: "Nie przesłano obrazu w polu 'image'." }, { status: 400 });
    }

    if (!(audio instanceof File)) {
      return NextResponse.json({ ok: false, error: "Nie przesłano audio w polu 'audio'." }, { status: 400 });
    }

    const positivePrompt = toStringValue(
      formData.get("positivePrompt"),
      "The character looks towards the suspended microphone and raps passionately. Very emotional performance"
    );
    const negativePrompt = toStringValue(
      formData.get("negativePrompt"),
      "bright tones, overexposed, static, blurred details, subtitles, static, overall gray, worst quality, low quality, JPEG compression residue, incomplete, extra fingers, poorly drawn hands, poorly drawn faces, deformed, disfigured, fused fingers, still picture, messy background, walking backwards"
    );
    const width = toPositiveInt(formData.get("width"), 480);
    const height = toPositiveInt(formData.get("height"), 832);
    const fps = toPositiveInt(formData.get("fps"), 25);
    const numFrames = toPositiveInt(formData.get("numFrames"), 750);
    const seed = toPositiveInt(formData.get("seed"), 940918897846710);
    const steps = toPositiveInt(formData.get("steps"), 7);
    const cfg = toNumber(formData.get("cfg"), 1);
    const shift = toNumber(formData.get("shift"), 11);
    const filenamePrefix = toStringValue(formData.get("filenamePrefix"), "video/ComfyUI");

    const uploadedImage = await uploadImageToComfy(image, apiKey);
    const uploadedAudio = await uploadAudioToComfy(audio, apiKey);

    const workflow = await loadWorkflowFromDisk();

    injectInputs(workflow, {
      imageName: uploadedImage.name,
      audioPath: uploadedAudio.path,
      positivePrompt,
      negativePrompt,
      width,
      height,
      fps,
      numFrames,
      seed,
      steps,
      cfg,
      shift,
      filenamePrefix,
    });

    const submitResult = await submitWorkflowToComfy(workflow, apiKey);

    return NextResponse.json({
      ok: true,
      promptId: submitResult.prompt_id,
      uploadedImage: uploadedImage.name,
      uploadedAudio: uploadedAudio.path,
      workflowPath: "workflow/lip-sync.json",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nieznany błąd serwera.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
