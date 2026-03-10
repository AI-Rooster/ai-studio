import { NextResponse } from "next/server";
import { generateCampaignPack } from "@/lib/openai/campaign-studio";
import { CampaignBrief, CampaignStrategy } from "@/lib/campaign-studio/types";

export const runtime = "nodejs";

type Payload = {
  brief?: CampaignBrief;
  approvedStrategy?: CampaignStrategy;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Payload;

    if (!payload?.brief || !payload?.approvedStrategy) {
      return NextResponse.json(
        { ok: false, error: "Brakuje briefu albo zaakceptowanej strategii." },
        { status: 400 }
      );
    }

    const campaignPack = await generateCampaignPack({
      brief: payload.brief,
      approvedStrategy: payload.approvedStrategy,
    });

    return NextResponse.json({ ok: true, campaignPack });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nieznany błąd serwera.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
