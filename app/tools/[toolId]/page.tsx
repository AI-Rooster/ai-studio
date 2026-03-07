import { redirect, notFound } from "next/navigation";
import ToolShell from "@/components/workspace/tool-shell";
import ToolComingSoon from "@/components/workspace/tool-coming-soon";
import SingleImageToolForm from "@/components/forms/single-image-tool-form";
import MultiImageSequenceForm from "@/components/forms/multi-image-sequence-form";
import TextPlusOptionsForm from "@/components/forms/text-plus-options-form";
import IconForgeForm from "@/components/forms/icon-forge-form";
import LipSyncForm from "@/components/forms/lip-sync-form";
import { createClient } from "@/lib/supabase/server";
import { getToolById } from "@/lib/tools/registry";

type ToolPageProps = {
  params: Promise<{
    toolId: string;
  }>;
};

export default async function ToolPage({ params }: ToolPageProps) {
  const { toolId } = await params;
  const tool = getToolById(toolId);

  if (!tool) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let content: React.ReactNode = <ToolComingSoon tool={tool} />;

  if (tool.id === "lip-sync" && tool.isImplemented) {
    content = <LipSyncForm tool={tool} />;
  } else if (tool.id === "icon-forge" && tool.isImplemented) {
    content = <IconForgeForm tool={tool} />;
  } else if (tool.isImplemented && tool.inputMode === "single-image") {
    content = <SingleImageToolForm tool={tool} />;
  } else if (tool.isImplemented && tool.inputMode === "multi-image-sequence") {
    content = <MultiImageSequenceForm tool={tool} />;
  } else if (tool.isImplemented && tool.inputMode === "text-plus-options") {
    content = <TextPlusOptionsForm tool={tool} />;
  }

  return <ToolShell tool={tool}>{content}</ToolShell>;
}
