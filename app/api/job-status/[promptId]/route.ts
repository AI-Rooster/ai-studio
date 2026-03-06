import { NextResponse } from "next/server";

export const runtime = "nodejs";

const COMFY_BASE_URL = "https://cloud.comfy.org";

function getApiKey() {
  const apiKey = process.env.COMFY_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error("Brakuje COMFY_CLOUD_API_KEY.");
  }
  return apiKey;
}

function normalizeStatus(data: any) {
  if (typeof data?.status === "string") {
    return {
      id: data.id ?? null,
      status: data.status,
      raw: data,
    };
  }

  if (data?.data && typeof data.data.status === "string") {
    return {
      id: data.data.id ?? null,
      status: data.data.status,
      raw: data,
    };
  }

  throw new Error("Nie rozpoznano formatu odpowiedzi statusu joba.");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ promptId: string }> }
) {
  try {
    const { promptId } = await context.params;
    const apiKey = getApiKey();

    const response = await fetch(
      `${COMFY_BASE_URL}/api/job/${promptId}/status`,
      {
        headers: {
          "X-API-Key": apiKey,
        },
        cache: "no-store",
      }
    );

    const text = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: `Status check failed (${response.status}): ${text}` },
        { status: response.status }
      );
    }

    const parsed = JSON.parse(text);
    const normalized = normalizeStatus(parsed);

    return NextResponse.json({
      ok: true,
      id: normalized.id,
      status: normalized.status,
      raw: normalized.raw,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Nieznany błąd",
      },
      { status: 500 }
    );
  }
}