import { NextResponse } from "next/server";
import {
  CampaignBrief,
  CampaignPack,
  CampaignStrategy,
} from "@/lib/campaign-studio/types";
import { generateLandingPageDraft } from "@/lib/openai/campaign-studio";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      brief?: CampaignBrief;
      approvedStrategy?: CampaignStrategy;
      campaignPack?: CampaignPack;
    };

    if (!body?.brief) {
      return NextResponse.json(
        { ok: false, error: "Brakuje briefu kampanii." },
        { status: 400 }
      );
    }

    if (!body?.approvedStrategy) {
      return NextResponse.json(
        { ok: false, error: "Brakuje zaakceptowanej strategii." },
        { status: 400 }
      );
    }

    if (!body?.campaignPack) {
      return NextResponse.json(
        { ok: false, error: "Brakuje campaign packa." },
        { status: 400 }
      );
    }

    const landingPageDraft = await generateLandingPageDraft({
      brief: body.brief,
      approvedStrategy: body.approvedStrategy,
      campaignPack: body.campaignPack,
    });

    return NextResponse.json({ ok: true, landingPageDraft });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nieznany błąd serwera.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
