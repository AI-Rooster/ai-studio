import MotionTransferForm from "@/components/forms/motion-transfer-form";

export default function MotionTransferPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
            Motion / Video
          </div>
          <h1 className="text-4xl font-bold">Motion Transfer</h1>
          <p className="mt-3 max-w-3xl text-zinc-400">
            Use a control video for motion and a reference image for appearance, then generate
            a new stylized clip from both inputs.
          </p>
        </div>

        <MotionTransferForm />
      </div>
    </main>
  );
}
