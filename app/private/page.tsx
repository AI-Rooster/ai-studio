import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/login/actions";
import GenerateImageForm from "@/components/generate-image-form";

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
    <main className="min-h-screen bg-zinc-950 text-white px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
          <h1 className="text-3xl font-bold mb-4">Panel użytkownika</h1>

          <p className="text-zinc-300 mb-2">Jesteś zalogowany jako:</p>
          <p className="text-lg font-medium mb-8">{user.email}</p>

          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-lg bg-white text-black font-medium px-5 py-3"
            >
              Wyloguj
            </button>
          </form>
        </div>

        <GenerateImageForm />
      </div>
    </main>
  );
}