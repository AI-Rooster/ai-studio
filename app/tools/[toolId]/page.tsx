import { notFound } from "next/navigation";
import { getToolById } from "@/lib/tools/registry";
import ToolShell from "@/components/workspace/tool-shell";
import GenerateImageForm from "@/components/generate-image-form";
import MultiImageSequenceForm from "@/components/forms/multi-image-sequence-form";
import LipSyncForm from "@/components/forms/lip-sync-form";
import ImageToImageForm from "@/components/forms/image-to-image-form";
import ProductGridForm from "@/components/forms/product-grid-form";
import ImageToVideoForm from "@/components/forms/image-to-video-form";
import InpaintImageForm from "@/components/forms/inpaint-image-form";
import OutpaintForm from "@/components/forms/outpaint-form";
import ProductMockupForm from "@/components/forms/product-mockup-form";
import UpscaleVideoForm from "@/components/forms/upscale-video-form";
import IconForgeForm from "@/components/forms/icon-forge-form";
import TextToVoiceForm from "@/components/forms/text-to-voice-form";
import MusicGeneratorForm from "@/components/forms/music-generator-form";
import CopywriterForm from "@/components/forms/copywriter-form";
import PictureTo3DForm from "@/components/forms/picture-to-3d-form";
import CampaignStudioForm from "@/components/forms/campaign-studio-form";

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

  if (tool.id === "multi-angle-image") {
    return (
      <ToolShell tool={tool}>
        <GenerateImageForm />
      </ToolShell>
    );
  }

  if (tool.id === "six-frame-video") {
    return (
      <ToolShell tool={tool}>
        <MultiImageSequenceForm
          toolId="six-frame-video"
          title="6-Frame Motion"
          description="Upload exactly 6 frames and generate one video."
        />
      </ToolShell>
    );
  }

  if (tool.id === "lip-sync") {
    return (
      <ToolShell tool={tool}>
        <LipSyncForm tool={tool} />
      </ToolShell>
    );
  }

  if (tool.id === "image-to-image") {
    return (
      <ToolShell tool={tool}>
        <ImageToImageForm
          toolId="image-to-image"
          title="Image to Image"
          description="Upload one image and generate a new variation based on prompt and settings."
        />
      </ToolShell>
    );
  }

  if (tool.id === "inpaint-image") {
    return (
      <ToolShell tool={tool}>
        <InpaintImageForm tool={tool} />
      </ToolShell>
    );
  }

  if (tool.id === "outpaint") {
    return (
      <ToolShell tool={tool}>
        <OutpaintForm />
      </ToolShell>
    );
  }

  if (tool.id === "product-mockup") {
    return (
      <ToolShell tool={tool}>
        <ProductMockupForm />
      </ToolShell>
    );
  }

  if (tool.id === "product-grid") {
    return (
      <ToolShell tool={tool}>
        <ProductGridForm
          toolId="product-grid"
          title="Product Grid"
          description="Upload one product image and generate a stitched campaign grid plus tiles and upscale."
        />
      </ToolShell>
    );
  }

  if (tool.id === "image-to-video") {
    return (
      <ToolShell tool={tool}>
        <ImageToVideoForm
          toolId="image-to-video"
          title="Image to Video"
          description="Upload one image and generate an animated video with prompt-driven motion."
        />
      </ToolShell>
    );
  }

  if (tool.id === "upscale-video") {
    return (
      <ToolShell tool={tool}>
        <UpscaleVideoForm />
      </ToolShell>
    );
  }

  if (tool.id === "icon-forge") {
    return (
      <ToolShell tool={tool}>
        <IconForgeForm tool={tool} />
      </ToolShell>
    );
  }

  if (tool.id === "text-to-voice") {
    return (
      <ToolShell tool={tool}>
        <TextToVoiceForm />
      </ToolShell>
    );
  }

  if (tool.id === "music-generator") {
    return (
      <ToolShell tool={tool}>
        <MusicGeneratorForm />
      </ToolShell>
    );
  }

  if (tool.id === "copywriter") {
    return (
      <ToolShell tool={tool}>
        <CopywriterForm />
      </ToolShell>
    );
  }

  if (tool.id === "campaign-studio") {
    return (
      <ToolShell tool={tool}>
        <CampaignStudioForm tool={tool} />
      </ToolShell>
    );
  }

  if (tool.id === "picture-to-3d") {
    return (
      <ToolShell tool={tool}>
        <PictureTo3DForm />
      </ToolShell>
    );
  }

  return (
    <ToolShell tool={tool}>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-300">
        This tool is coming soon.
      </div>
    </ToolShell>
  );
}
