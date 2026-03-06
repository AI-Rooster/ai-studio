import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/login/actions";

export default async function PrivatePage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-8">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                Private area
              </div>
              <h1 className="mb-3 text-4xl font-bold">Welcome back</h1>
              <p className="text-zinc-400">
                Signed in as <span className="text-zinc-200">{user.email}</span>
              </p>
            </div>

            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-xl bg-white px-5 py-3 font-medium text-black"
              >
                Wyloguj
              </button>
            </form>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Link
              href="/tools"
              className="rounded-2xl border border-zinc-800 bg-black/30 p-5 transition hover:border-zinc-700"
            >
              <div className="mb-2 text-xs uppercase tracking-[0.15em] text-zinc-500">
                Main action
              </div>
              <div className="mb-2 text-xl font-semibold">Open tools</div>
              <div className="text-sm text-zinc-400">
                Browse the tool catalog and launch a workflow.
              </div>
            </Link>

            <div className="rounded-2xl border border-zinc-800 bg-black/30 p-5">
              <div className="mb-2 text-xs uppercase tracking-[0.15em] text-zinc-500">
                Next
              </div>
              <div className="mb-2 text-xl font-semibold">History</div>
              <div className="text-sm text-zinc-400">
                Placeholder for saved jobs and generated assets.
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-black/30 p-5">
              <div className="mb-2 text-xs uppercase tracking-[0.15em] text-zinc-500">
                Next
              </div>
              <div className="mb-2 text-xl font-semibold">Asset library</div>
              <div className="text-sm text-zinc-400">
                Placeholder for stored renders and downloadable outputs.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
