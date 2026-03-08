export type ToolStatus = "active" | "beta" | "coming-soon";

export type ToolDefinition = {
  id: string;
  title: string;
  shortDescription: string;
  category: string;
  inputMode: string;
  outputMode: string;
  status: ToolStatus;
  badge?: string;
  accepts: string[];
  premium?: boolean;
  extraCredits?: boolean;
  creditNote?: string;
};
