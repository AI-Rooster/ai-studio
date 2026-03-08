import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TextToVideoForm from "@/components/forms/text-to-video-form";

export default async function TextToVideoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
          <div className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
            Motion
          </div>
          <h1 className="mb-3 text-4xl font-bold">Text to Video</h1>
          <p className="max-w-3xl text-zinc-400">
            Generate motion directly from prompt, timing and render settings.
          </p>
        </div>

        <TextToVideoForm />
      </div>
    </main>
  );
}
