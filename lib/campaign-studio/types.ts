export type CampaignGoal =
  | "sales"
  | "lead-generation"
  | "awareness"
  | "launch"
  | "traffic"
  | "retention"
  | "other";

export type CampaignChannel =
  | "meta-ads"
  | "google-ads"
  | "email"
  | "landing-page"
  | "organic-social"
  | "video"
  | "other";

export type AssetSummary = {
  name: string;
  type: string;
  sizeBytes: number;
};

export type CampaignBrief = {
  brandName: string;
  companyDescription: string;
  websiteUrl: string;
  productName: string;
  productCategory: string;
  productDescription: string;
  usp: string;
  offer: string;
  pricePoint: string;
  targetAudience: string;
  campaignGoal: CampaignGoal;
  market: string;
  budget: string;
  channels: CampaignChannel[];
  timeline: string;
  tone: string;
  mustInclude: string;
  constraints: string;
  successDefinition: string;
  additionalNotes: string;
  assets: {
    logo: AssetSummary | null;
    productImages: AssetSummary[];
    supportFiles: AssetSummary[];
  };
};

export type AudiencePersona = {
  name: string;
  snapshot: string;
  painPoints: string[];
  triggers: string[];
};

export type MessagingAngle = {
  name: string;
  promise: string;
  proof: string;
  cta: string;
};

export type ChannelPlanItem = {
  channel: string;
  role: string;
  budgetPercent: number;
  objective: string;
  whyThisChannel: string;
};

export type TimelineStep = {
  phase: string;
  focus: string;
  deliverables: string[];
};

export type KPIItem = {
  metric: string;
  target: string;
  reason: string;
};

export type AssetNeed = {
  assetType: string;
  purpose: string;
  notes: string;
};

export type CampaignStrategy = {
  campaignName: string;
  executiveSummary: string;
  positioning: string;
  coreOffer: string;
  corePromise: string;
  primaryAudience: AudiencePersona[];
  secondaryAudience: AudiencePersona[];
  messagingAngles: MessagingAngle[];
  channelPlan: ChannelPlanItem[];
  kpis: KPIItem[];
  timeline: TimelineStep[];
  risks: string[];
  assetNeeds: AssetNeed[];
  aiNotes: string[];
};

export type MetaAdDraft = {
  angle: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  creativeBrief: string;
};

export type MetaAdSet = {
  name: string;
  audience: string;
  objective: string;
  placements: string[];
  ads: MetaAdDraft[];
};

export type GoogleAdGroup = {
  name: string;
  intent: string;
  keywords: string[];
  headlines: string[];
  descriptions: string[];
};

export type EmailDraft = {
  name: string;
  subject: string;
  previewText: string;
  body: string;
  cta: string;
};

export type CreativeTask = {
  toolId: string;
  title: string;
  purpose: string;
  prompt: string;
  requiredAssets: string[];
  outputFormat: string;
  notes: string;
};

export type CampaignPack = {
  launchSummary: string;
  metaAds: {
    campaignObjective: string;
    adSets: MetaAdSet[];
  };
  googleAds: {
    campaignType: string;
    adGroups: GoogleAdGroup[];
  };
  email: {
    strategy: string;
    drafts: EmailDraft[];
  };
  landingPage: {
    heroHeadline: string;
    heroSubheadline: string;
    bullets: string[];
    cta: string;
    proofSection: string[];
  };
  creativeTasks: CreativeTask[];
  launchChecklist: string[];
  reportingPlan: string[];
};

export type LandingPageSection = {
  id: string;
  title: string;
  copy: string;
  bullets: string[];
  cta?: string;
  notes?: string;
};

export type LandingPageDraft = {
  pageName: string;
  urlSlug: string;
  seoTitle: string;
  metaDescription: string;
  hero: {
    eyebrow: string;
    headline: string;
    subheadline: string;
    primaryCta: string;
    secondaryCta: string;
  };
  sections: LandingPageSection[];
  faq: Array<{
    question: string;
    answer: string;
  }>;
  formCta: {
    headline: string;
    supportCopy: string;
    buttonLabel: string;
  };
  finalCta: {
    headline: string;
    text: string;
    buttonLabel: string;
  };
};
