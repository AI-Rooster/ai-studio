import { NextResponse } from "next/server";
import { generateCampaignStrategy } from "@/lib/openai/campaign-studio";
import { CampaignBrief, CampaignStrategy } from "@/lib/campaign-studio/types";

export const runtime = "nodejs";

type Payload = {
  brief?: CampaignBrief;
  revisionRequest?: string;
  previousStrategy?: CampaignStrategy | null;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Payload;

    if (!payload?.brief?.brandName || !payload?.brief?.productName) {
      return NextResponse.json(
        { ok: false, error: "Brief jest niekompletny. Uzupełnij markę i produkt." },
        { status: 400 }
      );
    }

    const strategy = await generateCampaignStrategy({
      brief: payload.brief,
      revisionRequest: payload.revisionRequest,
      previousStrategy: payload.previousStrategy ?? null,
    });

    return NextResponse.json({ ok: true, strategy });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nieznany błąd serwera.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
