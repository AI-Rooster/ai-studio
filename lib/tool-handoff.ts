export type ToolHandoffPayload = {
  source: "campaign-studio";
  toolId: string;
  taskTitle?: string;
  purpose?: string;
  prompt?: string;
  notes?: string;
  outputFormat?: string;
  requiredAssets?: string[];
  campaignName?: string;
  brandName?: string;
  productName?: string;
};

export function buildToolHandoffHref(payload: ToolHandoffPayload) {
  const params = new URLSearchParams();
  params.set("handoff", JSON.stringify(payload));
  return `/tools/${payload.toolId}?${params.toString()}`;
}

export function readToolHandoffFromSearchParams(
  searchParams: URLSearchParams | { get(name: string): string | null } | null | undefined
): ToolHandoffPayload | null {
  if (!searchParams) return null;
  const raw = searchParams.get("handoff");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ToolHandoffPayload;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.source !== "campaign-studio") return null;
    if (!parsed.toolId || typeof parsed.toolId !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}
