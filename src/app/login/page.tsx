import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-5xl font-bold mb-4">AI Studio</h1>
        <p className="text-zinc-400 mb-8">
          MVP do generowania obrazów i filmów przez Comfy Cloud API.
        </p>

        <div className="flex flex-wrap gap-4">
          {user ? (
            <Link
              href="/private"
              className="rounded-lg bg-white text-black px-5 py-3 font-medium"
            >
              Wejdź do panelu
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-white text-black px-5 py-3 font-medium"
            >
              Zaloguj / zarejestruj się
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}