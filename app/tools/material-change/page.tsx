import MaterialChangeForm from "@/components/forms/material-change-form";

export default function MaterialChangePage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
            Product Visuals
          </div>
          <h1 className="text-4xl font-bold">Material Change</h1>
          <p className="mt-3 max-w-3xl text-zinc-400">
            Nieplanowany tool do szybkiej zmiany materiału na produkcie. Wejście:
            zdjęcie produktu + referencja materiału.
          </p>
        </div>

        <MaterialChangeForm />
      </div>
    </main>
  );
}
