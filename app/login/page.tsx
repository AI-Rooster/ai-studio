import { signInAction, signUpAction } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const message = params.message ?? "";

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-4xl font-bold mb-3">AI Studio</h1>
        <p className="text-zinc-400 mb-8">
          Logowanie i rejestracja do panelu użytkownika.
        </p>

        {message ? (
          <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-200">
            {message}
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <form
            action={signInAction}
            className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
          >
            <h2 className="text-2xl font-semibold mb-4">Logowanie</h2>

            <label className="block text-sm text-zinc-300 mb-2">Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 mb-4 outline-none"
              placeholder="twoj@email.com"
            />

            <label className="block text-sm text-zinc-300 mb-2">Hasło</label>
            <input
              name="password"
              type="password"
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 mb-6 outline-none"
              placeholder="********"
            />

            <button
              type="submit"
              className="w-full rounded-lg bg-white text-black font-medium px-4 py-3"
            >
              Zaloguj się
            </button>
          </form>

          <form
            action={signUpAction}
            className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
          >
            <h2 className="text-2xl font-semibold mb-4">Rejestracja</h2>

            <label className="block text-sm text-zinc-300 mb-2">Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 mb-4 outline-none"
              placeholder="twoj@email.com"
            />

            <label className="block text-sm text-zinc-300 mb-2">Hasło</label>
            <input
              name="password"
              type="password"
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 mb-6 outline-none"
              placeholder="minimum 6 znaków"
            />

            <button
              type="submit"
              className="w-full rounded-lg bg-zinc-200 text-black font-medium px-4 py-3"
            >
              Załóż konto
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}