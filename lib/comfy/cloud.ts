import { readFile } from "fs/promises";
import path from "path";

export const COMFY_BASE_URL = "https://cloud.comfy.org";

export type WorkflowNode = {
  inputs?: Record<string, unknown>;
};

export type WorkflowJson = Record<string, WorkflowNode>;

export type UploadResponse = {
  name?: string;
  path?: string;
  subfolder?: string;
  type?: string;
};

export function getComfyApiKey() {
  const apiKey = process.env.COMFY_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error("Brakuje COMFY_CLOUD_API_KEY.");
  }
  return apiKey;
}

export async function loadWorkflowFromDisk(filename: string) {
  const workflowPath = path.join(process.cwd(), "workflow", filename);
  const raw = await readFile(workflowPath, "utf-8");
  return JSON.parse(raw) as WorkflowJson;
}

export function setInputValue(
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

export async function uploadImageToComfy(image: File, apiKey: string) {
  const formData = new FormData();
  formData.append("image", image);
  formData.append("type", "input");
  formData.append("overwrite", "true");

  const response = await fetch(`${COMFY_BASE_URL}/api/upload/image`, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
    body: formData,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Upload do Comfy Cloud nie powiódł się (${response.status}): ${text}`);
  }

  return JSON.parse(text) as UploadResponse;
}

export async function uploadUserDataFile(
  file: File,
  apiKey: string,
  targetPath?: string
) {
  const buffer = await file.arrayBuffer();
  const filename = targetPath ?? file.name.replace(/\s+/g, "-");
  const encodedPath = encodeURIComponent(filename);

  const response = await fetch(
    `${COMFY_BASE_URL}/api/userdata/${encodedPath}?overwrite=true&full_info=true`,
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
    throw new Error(`Upload userdata do Comfy Cloud nie powiódł się (${response.status}): ${text}`);
  }

  return JSON.parse(text) as UploadResponse;
}

export async function submitWorkflowToComfy(
  workflow: WorkflowJson,
  apiKey: string,
  extraData?: Record<string, unknown>
) {
  const body: Record<string, unknown> = { prompt: workflow };
  if (extraData && Object.keys(extraData).length > 0) {
    body.extra_data = extraData;
  }

  const response = await fetch(`${COMFY_BASE_URL}/api/prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Wysłanie workflow do Comfy Cloud nie powiodło się (${response.status}): ${text}`);
  }

  return JSON.parse(text) as { prompt_id: string };
}

export function getOptionalExtraData() {
  const comfyOrgApiKey = process.env.COMFY_ORG_API_KEY;
  if (!comfyOrgApiKey) return undefined;
  return {
    api_key_comfy_org: comfyOrgApiKey,
  };
}
