export type ToolCategory =
  | "product-visuals"
  | "motion"
  | "campaign-assets"
  | "avatar-tools"
  | string;

export type ToolStatus = "active" | "beta" | "coming-soon" | "disabled";
export type CreditMode = "standard" | "premium";

export type ToolDefinition = {
  id: string;
  title: string;
  shortDescription: string;
  category: ToolCategory;
  inputMode: string;
  outputMode: string;
  status: ToolStatus;
  badge?: string;
  accepts?: string[];
  creditMode?: CreditMode;
  creditCostNote?: string;
};
