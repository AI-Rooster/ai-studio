import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-black px-6 py-14 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 max-w-3xl">
          <div className="mb-3 text-xs uppercase tracking-[0.25em] text-zinc-500">
            AI Creative Studio
          </div>
          <h1 className="mb-4 text-6xl font-bold leading-tight">
            Marketing tools powered by Comfy workflows
          </h1>
          <p className="text-lg leading-8 text-zinc-400">
            A growing creative system for product visuals, video, campaign assets,
            avatar tools and rapid marketing experimentation.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            {user ? (
              <>
                <Link
                  href="/tools"
                  className="rounded-xl bg-white px-5 py-3 font-medium text-black"
                >
                  Open tools
                </Link>
                <Link
                  href="/private"
                  className="rounded-xl border border-zinc-700 px-5 py-3 font-medium text-white"
                >
                  Go to dashboard
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-xl bg-white px-5 py-3 font-medium text-black"
              >
                Zaloguj / zarejestruj się
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            "8-Angle Visuals",
            "6-Frame Motion",
            "Icon Forge",
            "Lip Sync",
            "Text to Video",
            "Infinite Talk",
            "Product Grid",
            "Scene Variants",
          ].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-zinc-300"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
