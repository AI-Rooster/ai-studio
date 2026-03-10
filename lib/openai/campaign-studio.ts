import {
  CampaignBrief,
  CampaignPack,
  CampaignStrategy,
  LandingPageDraft,
} from "@/lib/campaign-studio/types";

const OPENAI_BASE_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = process.env.OPENAI_CAMPAIGN_MODEL || "gpt-4o-mini";

type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Brakuje OPENAI_API_KEY.");
  }
  return apiKey;
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  const direct = tryParseJson(trimmed);
  if (direct) return direct;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) {
    const parsed = tryParseJson(fenced);
    if (parsed) return parsed;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = trimmed.slice(firstBrace, lastBrace + 1);
    const parsed = tryParseJson(sliced);
    if (parsed) return parsed;
  }

  throw new Error(
    "OpenAI zwróciło odpowiedź, której nie udało się sparsować jako JSON."
  );
}

async function callOpenAIJson<T>(
  messages: OpenAIMessage[],
  temperature = 0.6
) {
  const apiKey = getApiKey();

  const response = await fetch(OPENAI_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  const rawText = await response.text();
  let data: OpenAIChatResponse | null = null;
  try {
    data = JSON.parse(rawText) as OpenAIChatResponse;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.error?.message || `OpenAI request failed (${response.status}).`
    );
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI nie zwróciło treści odpowiedzi.");
  }

  return extractJsonObject(content) as T;
}

export async function generateCampaignStrategy(input: {
  brief: CampaignBrief;
  revisionRequest?: string;
  previousStrategy?: CampaignStrategy | null;
}) {
  const { brief, revisionRequest, previousStrategy } = input;

  const systemPrompt = [
    "You are a senior growth strategist and campaign planner for SMB brands.",
    "Return only valid JSON. No markdown. No code fences.",
    "Your job is to create a strategy that is detailed, commercially useful and directly executable by a marketer.",
    "Avoid vague advice. Avoid generic filler. Use concrete language.",
    "Do not invent unsupported product claims.",
    "Use the provided brief. If something is missing, make conservative assumptions and mention them in aiNotes.",
    "Structure the answer with these keys exactly:",
    "campaignName, executiveSummary, positioning, coreOffer, corePromise, primaryAudience, secondaryAudience, messagingAngles, channelPlan, kpis, timeline, risks, assetNeeds, aiNotes.",
    "Requirements:",
    "- executiveSummary must be 140-220 words and explain the logic of the campaign.",
    "- positioning must be specific and differentiated.",
    "- coreOffer must clearly explain what is being sold and why now.",
    "- corePromise must be a sharp value proposition, not a slogan.",
    "- primaryAudience must contain exactly 2 audience objects.",
    "- secondaryAudience must contain 1 or 2 audience objects.",
    "- each audience object must have: name, snapshot, painPoints[at least 3], triggers[at least 3].",
    "- messagingAngles must contain exactly 4 objects.",
    "- each messaging angle must have: name, promise, proof, cta.",
    "- promise and proof must be concrete and distinct between angles.",
    "- channelPlan must contain 3 to 5 objects depending on relevance.",
    "- each channelPlan item must have: channel, role, budgetPercent, objective, whyThisChannel.",
    "- budgetPercent values should add up to 100.",
    "- kpis must contain 5 to 7 objects.",
    "- timeline must contain exactly 3 phases: launch, scale, optimize.",
    "- each timeline phase must include at least 3 deliverables.",
    "- risks must contain at least 4 realistic risks.",
    "- assetNeeds must contain at least 6 items and be specific enough to brief creatives.",
    "- aiNotes must contain practical implementation notes, not fluff.",
    "- Keep the plan realistic for the stated budget, market and timeline.",
  ].join(" ");

  const userPayload = {
    brief,
    revisionRequest: revisionRequest || null,
    previousStrategy,
  };

  return callOpenAIJson<CampaignStrategy>(
    [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Build a detailed campaign strategy from this JSON input: ${JSON.stringify(
          userPayload
        )}`,
      },
    ],
    0.7
  );
}

export async function generateCampaignPack(input: {
  brief: CampaignBrief;
  approvedStrategy: CampaignStrategy;
}) {
  const { brief, approvedStrategy } = input;

  const systemPrompt = [
    "You are a senior marketing operator converting an approved strategy into an execution pack.",
    "Return only valid JSON. No markdown. No code fences.",
    "This output must feel like a real launch pack, not a sketch.",
    "Structure the answer with these keys exactly:",
    "launchSummary, metaAds, googleAds, email, landingPage, creativeTasks, launchChecklist, reportingPlan.",
    "Requirements:",
    "- launchSummary must be a plain string, 120-200 words, not an object.",
    "- metaAds is an object with campaignObjective and adSets[].",
    "- Each adSet has: name, audience, objective, placements[], ads[].",
    "- Each ad has: angle, primaryText, headline, description, cta, creativeBrief.",
    "- Write 2 ad sets with 2 ads each unless the budget is clearly too small.",
    "- googleAds is an object with campaignType and adGroups[].",
    "- Each adGroup has: name, intent, keywords[], headlines[], descriptions[].",
    "- Write 2 ad groups if search intent makes sense.",
    "- email is an object with strategy and drafts[].",
    "- Write 2 email drafts.",
    "- Each draft has: name, subject, previewText, body, cta.",
    "- landingPage is an object with heroHeadline, heroSubheadline, bullets[], cta, proofSection[].",
    "- creativeTasks is an array of objects: toolId, title, purpose, prompt, requiredAssets[], outputFormat, notes.",
    "- toolId should only use these tool ids: multi-angle-image, image-to-image, inpaint-image, outpaint, product-mockup, image-to-video, text-to-video, six-frame-video, icon-forge, product-grid, upscale-video.",
    "- For six-frame-video, treat it as ONE cohesive ~5-second video built from 6 key frames of the same scene, shot progression or micro-story.",
    "- Never describe six-frame-video as 6 unrelated scenes or a montage of disconnected ideas.",
    "- When you assign six-frame-video, the prompt must explicitly ask for 6 consecutive key frames that together form one consistent motion sequence, product reveal, camera move or scene evolution.",
    "- For six-frame-video, requiredAssets should mention that the user needs 6 consistent frames from the same concept or shot, not six separate concepts.",
    "- launchChecklist must contain at least 8 actionable steps.",
    "- reportingPlan must contain at least 6 actionable points.",
    "- Keep all copy aligned with the approved strategy.",
  ].join(" ");

  const userPayload = {
    brief,
    approvedStrategy,
  };

  return callOpenAIJson<CampaignPack>(
    [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Build a detailed campaign execution pack from this JSON input: ${JSON.stringify(
          userPayload
        )}`,
      },
    ],
    0.75
  );
}

export async function generateLandingPageDraft(input: {
  brief: CampaignBrief;
  approvedStrategy: CampaignStrategy;
  campaignPack: CampaignPack;
}) {
  const { brief, approvedStrategy, campaignPack } = input;

  const systemPrompt = [
    "You are a direct response landing page strategist for e-commerce and lead generation brands.",
    "Return only valid JSON. No markdown. No code fences.",
    "Build a usable landing page draft from the strategy and campaign pack.",
    "Structure the answer with these keys exactly:",
    "pageName, urlSlug, seoTitle, metaDescription, hero, sections, faq, formCta, finalCta.",
    "Rules:",
    "- hero has: eyebrow, headline, subheadline, primaryCta, secondaryCta.",
    "- sections is an array of 5 to 7 objects with: id, title, copy, bullets[], cta, notes.",
    "- faq is an array of exactly 5 objects with: question, answer.",
    "- formCta has: headline, supportCopy, buttonLabel.",
    "- finalCta has: headline, text, buttonLabel.",
    "- Make the page conversion-focused and aligned with the approved strategy.",
    "- Avoid fake guarantees or unsupported claims.",
    "- Bullet lists must be concrete and benefit-led.",
  ].join(" ");

  const userPayload = {
    brief,
    approvedStrategy,
    campaignPack,
  };

  return callOpenAIJson<LandingPageDraft>(
    [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Build a landing page draft from this JSON input: ${JSON.stringify(
          userPayload
        )}`,
      },
    ],
    0.75
  );
}
