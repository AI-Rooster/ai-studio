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

export async function GET(
  _request: Request,
  context: { params: Promise<{ promptId: string }> }
) {
  try {
    const { promptId } = await context.params;
    const apiKey = getApiKey();

    const response = await fetch(
      `${COMFY_BASE_URL}/api/jobs/${promptId}`,
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
        { ok: false, error: `Job details failed (${response.status}): ${text}` },
        { status: response.status }
      );
    }

    const data = JSON.parse(text);

    return NextResponse.json({
      ok: true,
      job: data,
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