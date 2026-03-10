"use client";

import Link from "next/link";
import { buildToolHandoffHref } from "@/lib/tool-handoff";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { ToolDefinition } from "@/lib/tools/types";
import {
  CampaignBrief,
  CampaignChannel,
  CampaignGoal,
  CampaignPack,
  CampaignStrategy,
  CreativeTask,
  LandingPageDraft,
} from "@/lib/campaign-studio/types";

type StrategyResponse =
  | { ok: true; strategy: CampaignStrategy }
  | { ok: false; error: string };

type CampaignPackResponse =
  | { ok: true; campaignPack: CampaignPack }
  | { ok: false; error: string };

type LandingPageDraftResponse =
  | { ok: true; landingPageDraft: LandingPageDraft }
  | { ok: false; error: string };

type Props = { tool?: ToolDefinition };

const STORAGE_KEY = "campaign-studio-brief-v2";

const fallbackTool: ToolDefinition = {
  id: "campaign-studio",
  title: "Campaign Studio",
  shortDescription: "Brief -> strategy -> campaign pack",
  longDescription:
    "Build a strategy and campaign-ready content pack from one guided brief.",
  category: "campaign-ops",
  inputMode: "guided brief",
  outputMode: "strategy + copy pack",
  status: "beta",
  badge: "New",
  accepts: ["image/png", "image/jpeg", "image/webp", ".pdf", ".doc", ".docx"],
  creditMode: "standard",
};

const defaultBrief: CampaignBrief = {
  brandName: "",
  companyDescription: "",
  websiteUrl: "",
  productName: "",
  productCategory: "",
  productDescription: "",
  usp: "",
  offer: "",
  pricePoint: "",
  targetAudience: "",
  campaignGoal: "sales",
  market: "Poland",
  budget: "5000 PLN",
  channels: ["meta-ads", "google-ads", "email"],
  timeline: "4 weeks",
  tone: "Premium, clear, practical",
  mustInclude: "",
  constraints: "",
  successDefinition: "",
  additionalNotes: "",
  assets: { logo: null, productImages: [], supportFiles: [] },
};

const channelOptions: Array<{ value: CampaignChannel; label: string }> = [
  { value: "meta-ads", label: "Meta Ads" },
  { value: "google-ads", label: "Google Ads" },
  { value: "email", label: "Email / Newsletter" },
  { value: "landing-page", label: "Landing Page" },
  { value: "organic-social", label: "Organic Social" },
  { value: "video", label: "Video / Shorts" },
];

const goalOptions: Array<{ value: CampaignGoal; label: string }> = [
  { value: "sales", label: "Sales" },
  { value: "lead-generation", label: "Lead generation" },
  { value: "awareness", label: "Awareness" },
  { value: "launch", label: "Launch" },
  { value: "traffic", label: "Traffic" },
  { value: "retention", label: "Retention" },
  { value: "other", label: "Other" },
];

function summarizeFile(file: File) {
  return {
    name: file.name,
    type: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value == null) return "";

  if (Array.isArray(value)) {
    return value.map(toText).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, entryValue]) => {
        const rendered = toText(entryValue);
        if (!rendered) return "";
        return `${key}: ${rendered}`;
      })
      .filter(Boolean);

    return entries.join(" • ");
  }

  return String(value);
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function makeKey(prefix: string, index: number, ...parts: unknown[]) {
  const normalized = parts
    .flatMap((part) => {
      if (Array.isArray(part)) return part;
      return [part];
    })
    .map((part) => {
      if (typeof part === "string") return part.trim();
      if (typeof part === "number" || typeof part === "boolean") {
        return String(part);
      }
      return "";
    })
    .filter(Boolean);

  return normalized.length > 0
    ? `${prefix}-${normalized.join("-")}-${index}`
    : `${prefix}-${index}`;
}

function buildLandingMarkdown(draft: LandingPageDraft) {
  const sectionText = safeArray<LandingPageDraft["sections"][number]>(draft.sections)
    .map((section) => {
      const bullets = safeArray<string>(section.bullets)
        .map((bullet) => `- ${bullet}`)
        .join("\n");
      return `## ${section.title}\n\n${section.copy}\n\n${bullets}${section.cta ? `\n\nCTA: ${section.cta}` : ""}`;
    })
    .join("\n\n");

  const faqText = safeArray<LandingPageDraft["faq"][number]>(draft.faq)
    .map((item) => `### ${item.question}\n${item.answer}`)
    .join("\n\n");

  return [
    `# ${draft.pageName}`,
    `Slug: ${draft.urlSlug}`,
    `SEO Title: ${draft.seoTitle}`,
    `Meta Description: ${draft.metaDescription}`,
    "",
    `## Hero`,
    `${draft.hero.eyebrow}`,
    `${draft.hero.headline}`,
    `${draft.hero.subheadline}`,
    `Primary CTA: ${draft.hero.primaryCta}`,
    `Secondary CTA: ${draft.hero.secondaryCta}`,
    "",
    sectionText,
    "",
    `## Form CTA`,
    `${draft.formCta.headline}`,
    `${draft.formCta.supportCopy}`,
    `Button: ${draft.formCta.buttonLabel}`,
    "",
    `## FAQ`,
    faqText,
    "",
    `## Final CTA`,
    `${draft.finalCta.headline}`,
    `${draft.finalCta.text}`,
    `Button: ${draft.finalCta.buttonLabel}`,
  ].join("\n");
}

function groupTasksByTool(tasks: CreativeTask[]) {
  return tasks.reduce<Record<string, CreativeTask[]>>((acc, task) => {
    const key = task?.toolId || "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});
}


function buildTaskHandoff(task: CreativeTask, brief: CampaignBrief, strategy: CampaignStrategy | null) {
  return buildToolHandoffHref({
    source: "campaign-studio",
    toolId: task.toolId,
    taskTitle: task.title,
    purpose: task.purpose,
    prompt: task.prompt,
    notes: task.notes,
    outputFormat: task.outputFormat,
    requiredAssets: task.requiredAssets,
    campaignName: strategy?.campaignName || brief.productName,
    brandName: brief.brandName,
    productName: brief.productName,
  });
}

function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-600"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        {subtitle ? <p className="mt-1 text-zinc-400">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-300">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-300">
        {label}
      </span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
      />
    </label>
  );
}

export default function CampaignStudioForm({ tool }: Props) {
  const resolvedTool = tool ?? fallbackTool;

  const [brief, setBrief] = useState<CampaignBrief>(defaultBrief);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [productImages, setProductImages] = useState<File[]>([]);
  const [supportFiles, setSupportFiles] = useState<File[]>([]);
  const [strategy, setStrategy] = useState<CampaignStrategy | null>(null);
  const [strategyEditor, setStrategyEditor] = useState("");
  const [revisionRequest, setRevisionRequest] = useState("");
  const [approvedStrategy, setApprovedStrategy] =
    useState<CampaignStrategy | null>(null);
  const [campaignPack, setCampaignPack] = useState<CampaignPack | null>(null);
  const [landingPageDraft, setLandingPageDraft] =
    useState<LandingPageDraft | null>(null);
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
  const [isGeneratingPack, setIsGeneratingPack] = useState(false);
  const [isGeneratingLandingDraft, setIsGeneratingLandingDraft] =
    useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as CampaignBrief;
      setBrief((current) => ({ ...current, ...saved }));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(brief));
    } catch {}
  }, [brief]);

  useEffect(() => {
    setBrief((current) => ({
      ...current,
      assets: {
        logo: logoFile ? summarizeFile(logoFile) : null,
        productImages: productImages.map(summarizeFile),
        supportFiles: supportFiles.map(summarizeFile),
      },
    }));
  }, [logoFile, productImages, supportFiles]);

  const selectedChannelLabels = useMemo(
    () =>
      channelOptions
        .filter((option) => brief.channels.includes(option.value))
        .map((option) => option.label)
        .join(", "),
    [brief.channels]
  );

  const groupedCreativeTasks = useMemo(
    () => groupTasksByTool(safeArray<CreativeTask>(campaignPack?.creativeTasks)),
    [campaignPack]
  );

  function updateBrief<Key extends keyof CampaignBrief>(
    key: Key,
    value: CampaignBrief[Key]
  ) {
    setBrief((current) => ({ ...current, [key]: value }));
  }

  function toggleChannel(channel: CampaignChannel) {
    setBrief((current) => ({
      ...current,
      channels: current.channels.includes(channel)
        ? current.channels.filter((item) => item !== channel)
        : [...current.channels, channel],
    }));
  }

  async function handleGenerateStrategy() {
    setError("");
    setSuccess("");
    setCampaignPack(null);
    setLandingPageDraft(null);

    if (!brief.brandName || !brief.productName || !brief.productDescription) {
      setError("Uzupełnij markę, nazwę produktu i opis produktu.");
      return;
    }

    try {
      setIsGeneratingStrategy(true);

      const response = await fetch("/api/tools/campaign-studio/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          revisionRequest: revisionRequest.trim() || undefined,
          previousStrategy: strategy,
        }),
      });

      const data = (await response.json()) as StrategyResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          "error" in data
            ? data.error
            : "Nie udało się wygenerować strategii."
        );
      }

      setStrategy(data.strategy);
      setStrategyEditor(prettyJson(data.strategy));
      setApprovedStrategy(null);
      setSuccess(
        "Strategia wygenerowana. Możesz ją zaakceptować albo doprecyzować."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    } finally {
      setIsGeneratingStrategy(false);
    }
  }

  function handleApproveStrategy() {
    setError("");
    setSuccess("");

    try {
      const parsed = JSON.parse(strategyEditor) as CampaignStrategy;
      setApprovedStrategy(parsed);
      setSuccess(
        "Strategia zaakceptowana. Możesz wygenerować pełny campaign pack."
      );
    } catch {
      setError(
        "Nie udało się odczytać strategii z edytora JSON. Popraw format albo wygeneruj ją ponownie."
      );
    }
  }

  async function handleGenerateCampaignPack() {
    setError("");
    setSuccess("");

    if (!approvedStrategy) {
      setError("Najpierw zaakceptuj strategię.");
      return;
    }

    try {
      setIsGeneratingPack(true);

      const response = await fetch("/api/tools/campaign-studio/campaign-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, approvedStrategy }),
      });

      const data = (await response.json()) as CampaignPackResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          "error" in data
            ? data.error
            : "Nie udało się wygenerować campaign packa."
        );
      }

      setCampaignPack(data.campaignPack);
      setLandingPageDraft(null);
      setSuccess("Campaign pack jest gotowy.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    } finally {
      setIsGeneratingPack(false);
    }
  }

  async function handleGenerateLandingPageDraft() {
    setError("");
    setSuccess("");

    if (!approvedStrategy || !campaignPack) {
      setError("Najpierw wygeneruj i zachowaj campaign pack.");
      return;
    }

    try {
      setIsGeneratingLandingDraft(true);

      const response = await fetch(
        "/api/tools/campaign-studio/landing-page-draft",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief, approvedStrategy, campaignPack }),
        }
      );

      const data = (await response.json()) as LandingPageDraftResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          "error" in data
            ? data.error
            : "Nie udało się wygenerować draftu landing page'a."
        );
      }

      setLandingPageDraft(data.landingPageDraft);
      setSuccess("Draft landing page'a jest gotowy.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    } finally {
      setIsGeneratingLandingDraft(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title={resolvedTool.title}
        subtitle="Pack 2: richer strategy + campaign pack + production board + landing page draft."
      >
        <div className="grid gap-3 md:grid-cols-5">
          {[
            { label: "1. Brief", active: true },
            { label: "2. Strategy", active: !!strategy },
            { label: "3. Approve", active: !!approvedStrategy },
            { label: "4. Campaign Pack", active: !!campaignPack },
            { label: "5. Landing Draft", active: !!landingPageDraft },
          ].map((step) => (
            <div
              key={step.label}
              className={`rounded-xl border p-4 text-sm ${
                step.active
                  ? "border-emerald-800 bg-emerald-950/30 text-emerald-200"
                  : "border-zinc-800 bg-black/40 text-zinc-400"
              }`}
            >
              {step.label}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Campaign brief"
        subtitle="Simple enough for a non-technical marketer, structured enough for AI to work from."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Brand name"
            value={brief.brandName}
            onChange={(value) => updateBrief("brandName", value)}
            placeholder="e.g. MUUVO"
          />
          <TextField
            label="Website URL"
            value={brief.websiteUrl}
            onChange={(value) => updateBrief("websiteUrl", value)}
            placeholder="https://..."
          />
          <TextField
            label="Product / service name"
            value={brief.productName}
            onChange={(value) => updateBrief("productName", value)}
            placeholder="e.g. Quick 4.0"
          />
          <TextField
            label="Category"
            value={brief.productCategory}
            onChange={(value) => updateBrief("productCategory", value)}
            placeholder="e.g. premium stroller"
          />

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-300">
              Campaign goal
            </span>
            <select
              value={brief.campaignGoal}
              onChange={(event) =>
                updateBrief("campaignGoal", event.target.value as CampaignGoal)
              }
              className="block w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
            >
              {goalOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <TextField
            label="Budget"
            value={brief.budget}
            onChange={(value) => updateBrief("budget", value)}
            placeholder="e.g. 5000 PLN / month"
          />
          <TextField
            label="Market"
            value={brief.market}
            onChange={(value) => updateBrief("market", value)}
            placeholder="e.g. Poland, Czech Republic"
          />
          <TextField
            label="Timeline"
            value={brief.timeline}
            onChange={(value) => updateBrief("timeline", value)}
            placeholder="e.g. 4 weeks"
          />
          <TextField
            label="Offer"
            value={brief.offer}
            onChange={(value) => updateBrief("offer", value)}
            placeholder="e.g. preorder + free accessories"
          />
          <TextField
            label="Price point"
            value={brief.pricePoint}
            onChange={(value) => updateBrief("pricePoint", value)}
            placeholder="e.g. premium but accessible"
          />
          <TextField
            label="USP / what makes it different"
            value={brief.usp}
            onChange={(value) => updateBrief("usp", value)}
            placeholder="e.g. lightweight, airflow, easy fold"
          />
          <TextField
            label="Tone of voice"
            value={brief.tone}
            onChange={(value) => updateBrief("tone", value)}
            placeholder="e.g. premium, modern, direct"
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TextAreaField
            label="Company / brand context"
            value={brief.companyDescription}
            onChange={(value) => updateBrief("companyDescription", value)}
            rows={4}
            placeholder="What does the brand stand for?"
          />
          <TextAreaField
            label="Product description"
            value={brief.productDescription}
            onChange={(value) => updateBrief("productDescription", value)}
            rows={4}
            placeholder="What is the product, who is it for, what problem does it solve?"
          />
          <TextAreaField
            label="Target audience"
            value={brief.targetAudience}
            onChange={(value) => updateBrief("targetAudience", value)}
            rows={4}
            placeholder="Who should buy this and why now?"
          />
          <TextAreaField
            label="Success definition"
            value={brief.successDefinition}
            onChange={(value) => updateBrief("successDefinition", value)}
            rows={4}
            placeholder="What should count as a good campaign result?"
          />
          <TextAreaField
            label="Must include"
            value={brief.mustInclude}
            onChange={(value) => updateBrief("mustInclude", value)}
            rows={3}
            placeholder="Mandatory claims, offers, CTAs, URLs, wording"
          />
          <TextAreaField
            label="Constraints / do not do"
            value={brief.constraints}
            onChange={(value) => updateBrief("constraints", value)}
            rows={3}
            placeholder="Legal, brand or production limitations"
          />
        </div>

        <div className="mt-4">
          <TextAreaField
            label="Additional notes"
            value={brief.additionalNotes}
            onChange={(value) => updateBrief("additionalNotes", value)}
            rows={4}
            placeholder="Anything else the strategist should know"
          />
        </div>

        <div className="mt-6 rounded-xl border border-zinc-800 bg-black/40 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-300">Channels</div>
          <div className="flex flex-wrap gap-3">
            {channelOptions.map((option) => {
              const active = brief.channels.includes(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleChannel(option.value)}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    active
                      ? "border-emerald-700 bg-emerald-950/40 text-emerald-200"
                      : "border-zinc-700 bg-zinc-950 text-zinc-300"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-sm text-zinc-500">
            Selected: {selectedChannelLabels || "None"}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-sky-900/40 bg-sky-950/20 p-4 text-sm text-sky-200">
          In Pack 2 uploaded assets still work mainly as planning context, but the
          production board now turns creative tasks into tool-specific execution
          cards and a generated landing page draft.
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <label className="block rounded-xl border border-zinc-800 bg-black/40 p-4">
            <span className="mb-2 block text-sm font-medium text-zinc-300">
              Logo
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            />
            <div className="mt-2 text-xs text-zinc-500">
              {logoFile ? logoFile.name : "No file selected"}
            </div>
          </label>

          <label className="block rounded-xl border border-zinc-800 bg-black/40 p-4">
            <span className="mb-2 block text-sm font-medium text-zinc-300">
              Product images
            </span>
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) =>
                setProductImages(Array.from(event.target.files ?? []))
              }
              className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            />
            <div className="mt-2 text-xs text-zinc-500">
              {productImages.length
                ? `${productImages.length} selected`
                : "No files selected"}
            </div>
          </label>

          <label className="block rounded-xl border border-zinc-800 bg-black/40 p-4">
            <span className="mb-2 block text-sm font-medium text-zinc-300">
              Extra files
            </span>
            <input
              type="file"
              multiple
              onChange={(event) =>
                setSupportFiles(Array.from(event.target.files ?? []))
              }
              className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            />
            <div className="mt-2 text-xs text-zinc-500">
              {supportFiles.length
                ? `${supportFiles.length} selected`
                : "No files selected"}
            </div>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleGenerateStrategy}
            disabled={isGeneratingStrategy}
            className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-60"
          >
            {isGeneratingStrategy ? "Generating strategy..." : "Generate strategy"}
          </button>

          <button
            type="button"
            onClick={() => {
              setBrief(defaultBrief);
              setLogoFile(null);
              setProductImages([]);
              setSupportFiles([]);
              setStrategy(null);
              setStrategyEditor("");
              setApprovedStrategy(null);
              setCampaignPack(null);
              setLandingPageDraft(null);
              setRevisionRequest("");
              setError("");
              setSuccess("");
              window.localStorage.removeItem(STORAGE_KEY);
            }}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm text-zinc-200"
          >
            Reset brief
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-4 rounded-xl border border-emerald-900 bg-emerald-950/30 p-4 text-sm text-emerald-200">
            {success}
          </div>
        ) : null}
      </SectionCard>

      {strategy ? (
        <SectionCard
          title="Strategy draft"
          subtitle="Use revision notes for simple changes. If you want exact control, edit the JSON below and approve it."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="mb-2 text-xs uppercase tracking-[0.15em] text-zinc-500">
                Campaign
              </div>
              <div className="text-xl font-semibold text-white">
                {toText(strategy.campaignName)}
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                {toText(strategy.executiveSummary)}
              </p>
              <div className="mt-4 text-sm text-zinc-400">
                Positioning: {toText(strategy.positioning)}
              </div>
              <div className="mt-2 text-sm text-zinc-400">
                Core promise: {toText(strategy.corePromise)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="mb-2 text-xs uppercase tracking-[0.15em] text-zinc-500">
                Recommended channel mix
              </div>

              <div className="space-y-3">
                {safeArray<CampaignStrategy["channelPlan"][number]>(
                  strategy.channelPlan
                ).map((item, index) => (
                  <div
                    key={makeKey(
                      "channel",
                      index,
                      item?.channel,
                      item?.objective
                    )}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-white">
                        {toText(item?.channel)}
                      </div>
                      <div className="text-sm text-emerald-300">
                        {toText(item?.budgetPercent)}%
                      </div>
                    </div>
                    <div className="mt-1 text-sm text-zinc-400">
                      {toText(item?.objective)}
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">
                      {toText(item?.whyThisChannel)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="mb-3 text-xs uppercase tracking-[0.15em] text-zinc-500">
                Primary audience
              </div>
              <div className="space-y-3">
                {safeArray<CampaignStrategy["primaryAudience"][number]>(
                  strategy.primaryAudience
                ).map((audience, index) => (
                  <div key={makeKey("audience", index, audience?.name)}>
                    <div className="font-medium text-white">
                      {toText(audience?.name)}
                    </div>
                    <div className="text-sm text-zinc-400">
                      {toText(audience?.snapshot)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="mb-3 text-xs uppercase tracking-[0.15em] text-zinc-500">
                Messaging angles
              </div>
              <div className="space-y-3">
                {safeArray<CampaignStrategy["messagingAngles"][number]>(
                  strategy.messagingAngles
                ).map((angle, index) => (
                  <div
                    key={makeKey("angle", index, angle?.name, angle?.cta)}
                  >
                    <div className="font-medium text-white">
                      {toText(angle?.name)}
                    </div>
                    <div className="text-sm text-zinc-400">
                      {toText(angle?.promise)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="mb-3 text-xs uppercase tracking-[0.15em] text-zinc-500">
                Asset needs
              </div>
              <div className="space-y-3">
                {safeArray<CampaignStrategy["assetNeeds"][number]>(
                  strategy.assetNeeds
                ).map((asset, index) => (
                  <div
                    key={makeKey(
                      "asset-need",
                      index,
                      asset?.assetType,
                      asset?.purpose
                    )}
                  >
                    <div className="font-medium text-white">
                      {toText(asset?.assetType)}
                    </div>
                    <div className="text-sm text-zinc-400">
                      {toText(asset?.purpose)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_260px]">
            <div>
              <TextAreaField
                label="Revision request"
                value={revisionRequest}
                onChange={setRevisionRequest}
                rows={4}
                placeholder="What should change? Example: less premium tone, stronger focus on price, more Google Ads, remove email."
              />
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4 text-sm text-zinc-400">
              Quick way to modify: type what should change and generate strategy
              again. Exact way: edit JSON below and approve it.
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleGenerateStrategy}
              disabled={isGeneratingStrategy}
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm text-zinc-200 disabled:opacity-60"
            >
              {isGeneratingStrategy ? "Updating strategy..." : "Regenerate strategy"}
            </button>

            <button
              type="button"
              onClick={handleApproveStrategy}
              className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black"
            >
              Approve current strategy JSON
            </button>

            <CopyButton value={strategyEditor} label="Copy strategy JSON" />
          </div>

          <div className="mt-6">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-300">
                Structured strategy JSON
              </span>
              <textarea
                rows={24}
                value={strategyEditor}
                onChange={(event) => setStrategyEditor(event.target.value)}
                className="block w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-mono text-xs text-zinc-200"
              />
            </label>
          </div>
        </SectionCard>
      ) : null}

      {approvedStrategy ? (
        <SectionCard
          title="Approved strategy"
          subtitle="This is the version that will be used to build the campaign pack."
        >
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-emerald-900 bg-emerald-950/20 p-4">
            <div>
              <div className="text-lg font-semibold text-emerald-200">
                {toText(approvedStrategy.campaignName)}
              </div>
              <div className="mt-1 text-sm text-emerald-100/80">
                {toText(approvedStrategy.executiveSummary)}
              </div>
            </div>

            <CopyButton
              value={prettyJson(approvedStrategy)}
              label="Copy approved strategy"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleGenerateCampaignPack}
              disabled={isGeneratingPack}
              className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-60"
            >
              {isGeneratingPack
                ? "Generating campaign pack..."
                : "Generate campaign pack"}
            </button>
          </div>
        </SectionCard>
      ) : null}

      {campaignPack ? (
        <SectionCard
          title="Campaign pack"
          subtitle="Execution-ready draft pack for Meta, Google, email, landing and creative production."
        >
          <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
            <div className="text-lg font-semibold text-white">Launch summary</div>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              {toText(campaignPack.launchSummary)}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <CopyButton value={prettyJson(campaignPack.metaAds)} label="Copy Meta ads" />
            <CopyButton value={prettyJson(campaignPack.googleAds)} label="Copy Google ads" />
            <CopyButton value={prettyJson(campaignPack.email)} label="Copy email pack" />
            <button
              type="button"
              onClick={handleGenerateLandingPageDraft}
              disabled={isGeneratingLandingDraft}
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm text-zinc-200 disabled:opacity-60"
            >
              {isGeneratingLandingDraft
                ? "Generating landing draft..."
                : "Generate landing page draft"}
            </button>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="mb-3 text-lg font-semibold text-white">Meta Ads</div>
              <div className="mb-3 text-sm text-zinc-400">
                Objective: {toText(campaignPack.metaAds?.campaignObjective)}
              </div>

              <div className="space-y-4">
                {safeArray<CampaignPack["metaAds"]["adSets"][number]>(
                  campaignPack.metaAds?.adSets
                ).map((adSet, adSetIndex) => (
                  <div
                    key={makeKey(
                      "meta-adset",
                      adSetIndex,
                      adSet?.name,
                      adSet?.audience
                    )}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                  >
                    <div className="font-medium text-white">
                      {toText(adSet?.name)}
                    </div>
                    <div className="mt-1 text-sm text-zinc-400">
                      Audience: {toText(adSet?.audience)}
                    </div>
                    <div className="mt-1 text-sm text-zinc-400">
                      Placements: {safeArray<string>(adSet?.placements).map(toText).join(", ")}
                    </div>

                    <div className="mt-3 space-y-3">
                      {safeArray<CampaignPack["metaAds"]["adSets"][number]["ads"][number]>(
                        adSet?.ads
                      ).map((ad, adIndex) => (
                        <div
                          key={makeKey(
                            "meta-ad",
                            adIndex,
                            ad?.angle,
                            ad?.headline
                          )}
                          className="rounded-xl border border-zinc-800 bg-black/50 p-3"
                        >
                          <div className="text-sm font-medium text-white">
                            {toText(ad?.angle)}
                          </div>
                          <div className="mt-2 text-sm text-zinc-300">
                            {toText(ad?.primaryText)}
                          </div>
                          <div className="mt-2 text-xs uppercase tracking-[0.15em] text-zinc-500">
                            Headline
                          </div>
                          <div className="text-sm text-zinc-300">
                            {toText(ad?.headline)}
                          </div>
                          <div className="mt-2 text-xs uppercase tracking-[0.15em] text-zinc-500">
                            Creative brief
                          </div>
                          <div className="text-sm text-zinc-400">
                            {toText(ad?.creativeBrief)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="mb-3 text-lg font-semibold text-white">Google Ads</div>
              <div className="mb-3 text-sm text-zinc-400">
                Type: {toText(campaignPack.googleAds?.campaignType)}
              </div>

              <div className="space-y-4">
                {safeArray<CampaignPack["googleAds"]["adGroups"][number]>(
                  campaignPack.googleAds?.adGroups
                ).map((group, groupIndex) => (
                  <div
                    key={makeKey(
                      "google-group",
                      groupIndex,
                      group?.name,
                      group?.intent
                    )}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                  >
                    <div className="font-medium text-white">
                      {toText(group?.name)}
                    </div>
                    <div className="mt-1 text-sm text-zinc-400">
                      {toText(group?.intent)}
                    </div>
                    <div className="mt-3 text-xs uppercase tracking-[0.15em] text-zinc-500">
                      Keywords
                    </div>
                    <div className="mt-1 text-sm text-zinc-300">
                      {safeArray<string>(group?.keywords).map(toText).join(", ")}
                    </div>
                    <div className="mt-3 text-xs uppercase tracking-[0.15em] text-zinc-500">
                      Headlines
                    </div>
                    <ul className="mt-1 space-y-1 text-sm text-zinc-300">
                      {safeArray<string>(group?.headlines).map((headline, headlineIndex) => (
                        <li
                          key={makeKey(
                            "google-headline",
                            headlineIndex,
                            headline
                          )}
                        >
                          • {toText(headline)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="mb-3 text-lg font-semibold text-white">
                Email / newsletter
              </div>
              <div className="mb-3 text-sm text-zinc-400">
                {toText(campaignPack.email?.strategy)}
              </div>
              <div className="space-y-4">
                {safeArray<CampaignPack["email"]["drafts"][number]>(
                  campaignPack.email?.drafts
                ).map((draft, draftIndex) => (
                  <div
                    key={makeKey(
                      "email-draft",
                      draftIndex,
                      draft?.name,
                      draft?.subject
                    )}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                  >
                    <div className="font-medium text-white">{toText(draft?.name)}</div>
                    <div className="mt-1 text-sm text-zinc-300">
                      Subject: {toText(draft?.subject)}
                    </div>
                    <div className="mt-1 text-sm text-zinc-400">
                      Preview: {toText(draft?.previewText)}
                    </div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                      {toText(draft?.body)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="mb-3 text-lg font-semibold text-white">Landing page copy</div>
              <div className="text-xl font-semibold text-white">
                {toText(campaignPack.landingPage?.heroHeadline)}
              </div>
              <div className="mt-2 text-sm text-zinc-300">
                {toText(campaignPack.landingPage?.heroSubheadline)}
              </div>
              <div className="mt-4 text-xs uppercase tracking-[0.15em] text-zinc-500">
                Bullets
              </div>
              <ul className="mt-2 space-y-2 text-sm text-zinc-300">
                {safeArray<string>(campaignPack.landingPage?.bullets).map((bullet, bulletIndex) => (
                  <li key={makeKey("landing-bullet", bulletIndex, bullet)}>
                    • {toText(bullet)}
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-xs uppercase tracking-[0.15em] text-zinc-500">
                CTA
              </div>
              <div className="mt-1 text-sm text-zinc-300">
                {toText(campaignPack.landingPage?.cta)}
              </div>
              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
                This is still copy-first. The actual structured landing page draft is generated in the next step.
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-zinc-800 bg-black/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">Production board</div>
                <div className="text-sm text-zinc-400">
                  Tool-specific execution cards generated from the campaign pack.
                </div>
              </div>
              <CopyButton
                value={prettyJson(campaignPack.creativeTasks)}
                label="Copy creative tasks"
              />
            </div>

            <div className="space-y-4">
              {Object.entries(groupedCreativeTasks).map(([toolId, tasks], groupIndex) => (
                <div
                  key={makeKey("task-group", groupIndex, toolId)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm uppercase tracking-[0.15em] text-zinc-500">
                        Tool
                      </div>
                      <div className="text-lg font-semibold text-white">{toolId}</div>
                    </div>
                    {tasks[0] ? (
                      <Link
                        href={buildTaskHandoff(tasks[0], brief, approvedStrategy)}
                        className="rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm text-zinc-200 hover:border-zinc-600"
                      >
                        Open first task with handoff
                      </Link>
                    ) : null}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {tasks.map((task, taskIndex) => (
                      <div
                        key={makeKey(
                          "creative-task",
                          taskIndex,
                          task?.toolId,
                          task?.title
                        )}
                        className="rounded-xl border border-zinc-800 bg-black/50 p-4"
                      >
                        <div className="text-lg font-medium text-white">{toText(task?.title)}</div>
                        <div className="mt-2 text-sm text-zinc-300">{toText(task?.purpose)}</div>
                        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-sm leading-6 text-zinc-300">
                          {toText(task?.prompt)}
                        </div>
                        <div className="mt-3 text-xs text-zinc-500">
                          Assets: {safeArray<string>(task?.requiredAssets).length > 0 ? safeArray<string>(task?.requiredAssets).map(toText).join(", ") : "None specified"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          Output: {toText(task?.outputFormat)}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          Notes: {toText(task?.notes)}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <CopyButton value={toText(task?.prompt)} label="Copy prompt" />
                          <Link
                            href={buildTaskHandoff(task, brief, approvedStrategy)}
                            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-600"
                          >
                            Open in tool
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="mb-3 text-lg font-semibold text-white">Launch checklist</div>
              <ul className="space-y-2 text-sm text-zinc-300">
                {safeArray<string>(campaignPack.launchChecklist).map((item, itemIndex) => (
                  <li key={makeKey("launch-check", itemIndex, item)}>
                    • {toText(item)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="mb-3 text-lg font-semibold text-white">Reporting plan</div>
              <ul className="space-y-2 text-sm text-zinc-300">
                {safeArray<string>(campaignPack.reportingPlan).map((item, itemIndex) => (
                  <li key={makeKey("reporting", itemIndex, item)}>
                    • {toText(item)}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <CopyButton value={prettyJson(campaignPack)} label="Copy campaign pack JSON" />
          </div>
        </SectionCard>
      ) : null}

      {landingPageDraft ? (
        <SectionCard
          title="Landing page draft"
          subtitle="A structured page draft you can hand to design/dev or use as the basis for a future landing builder."
        >
          <div className="flex flex-wrap gap-3">
            <CopyButton value={prettyJson(landingPageDraft)} label="Copy landing draft JSON" />
            <CopyButton value={buildLandingMarkdown(landingPageDraft)} label="Copy landing markdown" />
          </div>

          <div className="mt-4 rounded-xl border border-zinc-800 bg-black/40 p-4">
            <div className="text-xs uppercase tracking-[0.15em] text-zinc-500">SEO</div>
            <div className="mt-2 text-lg font-semibold text-white">{toText(landingPageDraft.seoTitle)}</div>
            <div className="mt-2 text-sm text-zinc-300">{toText(landingPageDraft.metaDescription)}</div>
            <div className="mt-3 text-xs text-zinc-500">Slug: /{toText(landingPageDraft.urlSlug)}</div>
          </div>

          <div className="mt-4 rounded-xl border border-zinc-800 bg-black/40 p-4">
            <div className="text-xs uppercase tracking-[0.15em] text-zinc-500">Hero</div>
            <div className="mt-2 text-sm text-zinc-400">{toText(landingPageDraft.hero.eyebrow)}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{toText(landingPageDraft.hero.headline)}</div>
            <div className="mt-2 text-sm text-zinc-300">{toText(landingPageDraft.hero.subheadline)}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">{toText(landingPageDraft.hero.primaryCta)}</span>
              <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300">{toText(landingPageDraft.hero.secondaryCta)}</span>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {safeArray<LandingPageDraft["sections"][number]>(landingPageDraft.sections).map((section, sectionIndex) => (
              <div
                key={makeKey("lp-section", sectionIndex, section?.id, section?.title)}
                className="rounded-xl border border-zinc-800 bg-black/40 p-4"
              >
                <div className="text-xs uppercase tracking-[0.15em] text-zinc-500">{toText(section?.id)}</div>
                <div className="mt-2 text-lg font-semibold text-white">{toText(section?.title)}</div>
                <div className="mt-2 text-sm leading-6 text-zinc-300">{toText(section?.copy)}</div>
                {safeArray<string>(section?.bullets).length ? (
                  <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                    {safeArray<string>(section?.bullets).map((bullet, bulletIndex) => (
                      <li key={makeKey("lp-bullet", bulletIndex, bullet)}>
                        • {toText(bullet)}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {section?.cta ? (
                  <div className="mt-3 text-sm text-emerald-300">CTA: {toText(section.cta)}</div>
                ) : null}
                {section?.notes ? (
                  <div className="mt-2 text-xs text-zinc-500">Notes: {toText(section.notes)}</div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="mb-3 text-lg font-semibold text-white">FAQ</div>
              <div className="space-y-4">
                {safeArray<LandingPageDraft["faq"][number]>(landingPageDraft.faq).map((item, faqIndex) => (
                  <div key={makeKey("faq", faqIndex, item?.question)}>
                    <div className="font-medium text-white">{toText(item?.question)}</div>
                    <div className="mt-1 text-sm text-zinc-300">{toText(item?.answer)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
                <div className="mb-3 text-lg font-semibold text-white">Form CTA</div>
                <div className="text-white">{toText(landingPageDraft.formCta.headline)}</div>
                <div className="mt-2 text-sm text-zinc-300">{toText(landingPageDraft.formCta.supportCopy)}</div>
                <div className="mt-3 inline-flex rounded-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200">{toText(landingPageDraft.formCta.buttonLabel)}</div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
                <div className="mb-3 text-lg font-semibold text-white">Final CTA</div>
                <div className="text-white">{toText(landingPageDraft.finalCta.headline)}</div>
                <div className="mt-2 text-sm text-zinc-300">{toText(landingPageDraft.finalCta.text)}</div>
                <div className="mt-3 inline-flex rounded-full border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">{toText(landingPageDraft.finalCta.buttonLabel)}</div>
              </div>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
