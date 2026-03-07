export type ToolCategory =
  | "product-visuals"
  | "motion"
  | "campaign-assets"
  | "avatar-tools";

export type ToolInputMode =
  | "single-image"
  | "multi-image-sequence"
  | "text-plus-options"
  | "mixed-input";

export type ToolOutputMode =
  | "image-gallery"
  | "video"
  | "asset-pack"
  | "json";

export type ToolStatus = "active" | "beta" | "coming-soon";
export type ToolCreditMode = "standard" | "premium";

export type ToolDefinition = {
  id: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  category: ToolCategory;
  inputMode: ToolInputMode;
  outputMode: ToolOutputMode;
  accepts: string[];
  minFiles: number;
  maxFiles: number;
  status: ToolStatus;
  badge?: string;
  isImplemented: boolean;
  generateRoute?: string;
  statusRouteBase?: string;
  detailsRouteBase?: string;
  outputRoute?: string;
  creditMode?: ToolCreditMode;
  creditCostNote?: string;
};
