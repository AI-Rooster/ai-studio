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

export async function GET(request: Request) {
  try {
    const apiKey = getApiKey();
    const { searchParams } = new URL(request.url);

    const filename = searchParams.get("filename");
    const subfolder = searchParams.get("subfolder") ?? "";
    const type = searchParams.get("type") ?? "output";

    if (!filename) {
      return NextResponse.json(
        { ok: false, error: "Brakuje filename" },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({
      filename,
      subfolder,
      type,
    });

    const response = await fetch(`${COMFY_BASE_URL}/api/view?${params}`, {
      headers: {
        "X-API-Key": apiKey,
      },
      redirect: "manual",
      cache: "no-store",
    });

    if (response.status !== 302) {
      const text = await response.text();
      return NextResponse.json(
        { ok: false, error: `View failed (${response.status}): ${text}` },
        { status: response.status }
      );
    }

    const signedUrl = response.headers.get("location");

    if (!signedUrl) {
      return NextResponse.json(
        { ok: false, error: "Brak signed URL w odpowiedzi" },
        { status: 500 }
      );
    }

    return NextResponse.redirect(signedUrl);
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