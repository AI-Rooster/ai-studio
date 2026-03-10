"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ToolDefinition } from "@/lib/tools/types";
import ImageGalleryRenderer from "@/components/renderers/image-gallery-renderer";
import {
  collectOutputFiles,
  JobDetails,
  JobDetailsResponse,
  JobStatusResponse,
  sleep,
  uniqOutputFiles,
} from "@/lib/job-client";

type GenerateResponse =
  | {
      ok: true;
      promptId: string;
      uploadedFile: string;
      workflowPath: string;
    }
  | {
      ok: false;
      error: string;
    };

type Props = {
  tool?: ToolDefinition;
};

const fallbackTool: ToolDefinition = {
  id: "inpaint-image",
  title: "Inpaint Image",
  shortDescription: "Image + mask -> replace selected region",
  longDescription: "Paint the area to replace directly in the browser.",
  category: "product-visuals",
  inputMode: "image-plus-mask",
  outputMode: "image-gallery",
  status: "active",
  accepts: ["image/png", "image/jpeg", "image/webp"],
  creditMode: "standard",
  generateRoute: "/api/tools/inpaint-image/generate",
  statusRouteBase: "/api/job-status",
  detailsRouteBase: "/api/job-details",
  outputRoute: "/api/output",
};

type Point = {
  x: number;
  y: number;
};

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

async function fileToImageBitmap(file: File) {
  return await createImageBitmap(file);
}

function canvasHasMask(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) {
      return true;
    }
  }

  return false;
}

async function buildMaskedInpaintImage(
  sourceFile: File,
  maskCanvas: HTMLCanvasElement
) {
  const sourceBitmap = await fileToImageBitmap(sourceFile);
  const width = sourceBitmap.width;
  const height = sourceBitmap.height;

  const imageCanvas = document.createElement("canvas");
  imageCanvas.width = width;
  imageCanvas.height = height;
  const imageCtx = imageCanvas.getContext("2d");

  if (!imageCtx) {
    throw new Error("Nie udało się przygotować canvas do inpaintu.");
  }

  imageCtx.drawImage(sourceBitmap, 0, 0, width, height);

  const imageData = imageCtx.getImageData(0, 0, width, height);
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });

  if (!maskCtx) {
    throw new Error("Nie udało się odczytać maski z canvas.");
  }

  const maskData = maskCtx.getImageData(0, 0, width, height);

  for (let i = 0; i < imageData.data.length; i += 4) {
    const maskAlpha = maskData.data[i + 3];
    imageData.data[i + 3] = Math.max(0, Math.min(255, 255 - maskAlpha));
  }

  imageCtx.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    imageCanvas.toBlob((value) => {
      if (value) {
        resolve(value);
        return;
      }
      reject(new Error("Nie udało się stworzyć pliku PNG z maską."));
    }, "image/png");
  });

  return new File([blob], `${stripExtension(sourceFile.name)}-inpaint-mask.png`, {
    type: "image/png",
  });
}

function getCanvasPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function drawSegment(
  canvas: HTMLCanvasElement,
  from: Point,
  to: Point,
  mode: "paint" | "erase",
  brushSize: number
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = brushSize;

  if (mode === "erase") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(239, 68, 68, 0.92)";
  }

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

export default function InpaintImageForm({ tool = fallbackTool }: Props) {
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [prompt, setPrompt] = useState(
    "Replace only the masked area. Keep the rest of the image consistent, realistic and clean."
  );
  const [seed, setSeed] = useState(656821733471329);
  const [steps, setSteps] = useState(20);
  const [guidance, setGuidance] = useState(30);
  const [filenamePrefix, setFilenamePrefix] = useState("FluxFill/Inpaint");
  const [brushSize, setBrushSize] = useState(44);
  const [brushMode, setBrushMode] = useState<"paint" | "erase">("paint");
  const [maskOpacity, setMaskOpacity] = useState(0.7);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(
    null
  );
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [promptId, setPromptId] = useState("");
  const [status, setStatus] = useState("");
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);

  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);

  const outputFiles = useMemo(() => {
    if (!jobDetails?.outputs) return [];
    return uniqOutputFiles(collectOutputFiles(jobDetails.outputs)).filter(
      (item) => item.type === "output"
    );
  }, [jobDetails]);

  const resetMaskCanvas = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasMask(false);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function prepareCanvas(file: File) {
      try {
        const bitmap = await fileToImageBitmap(file);
        if (isCancelled) return;

        const nextWidth = bitmap.width;
        const nextHeight = bitmap.height;
        const baseCanvas = baseCanvasRef.current;
        const maskCanvas = maskCanvasRef.current;

        if (!baseCanvas || !maskCanvas) return;

        baseCanvas.width = nextWidth;
        baseCanvas.height = nextHeight;
        maskCanvas.width = nextWidth;
        maskCanvas.height = nextHeight;

        const baseCtx = baseCanvas.getContext("2d");
        const maskCtx = maskCanvas.getContext("2d");

        if (!baseCtx || !maskCtx) {
          throw new Error("Nie udało się przygotować canvasa edytora.");
        }

        baseCtx.clearRect(0, 0, nextWidth, nextHeight);
        baseCtx.drawImage(bitmap, 0, 0, nextWidth, nextHeight);
        maskCtx.clearRect(0, 0, nextWidth, nextHeight);

        setCanvasSize({ width: nextWidth, height: nextHeight });
        setIsEditorReady(true);
        setHasMask(false);
      } catch (err) {
        if (!isCancelled) {
          setIsEditorReady(false);
          setCanvasSize(null);
          setHasMask(false);
          setError(err instanceof Error ? err.message : "Nie udało się przygotować edytora maski.");
        }
      }
    }

    if (!sourceImage) {
      setCanvasSize(null);
      setIsEditorReady(false);
      setHasMask(false);
      const baseCanvas = baseCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      baseCanvas?.getContext("2d")?.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
      maskCanvas?.getContext("2d")?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      return () => {
        isCancelled = true;
      };
    }

    void prepareCanvas(sourceImage);

    return () => {
      isCancelled = true;
    };
  }, [sourceImage]);

  async function fetchJobDetails(currentPromptId: string) {
    if (!tool.detailsRouteBase) {
      throw new Error("Missing details route for this tool.");
    }

    const response = await fetch(`${tool.detailsRouteBase}/${currentPromptId}`, {
      cache: "no-store",
    });

    const data = (await response.json()) as JobDetailsResponse;

    if (!response.ok || !data.ok) {
      throw new Error("Nie udało się pobrać szczegółów joba.");
    }

    return data.job;
  }

  async function pollUntilFinished(currentPromptId: string) {
    if (!tool.statusRouteBase) {
      throw new Error("Missing status route for this tool.");
    }

    const maxAttempts = 120;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(`${tool.statusRouteBase}/${currentPromptId}`, {
        cache: "no-store",
      });

      const data = (await response.json()) as JobStatusResponse;

      if (!response.ok || !data.ok) {
        throw new Error("Nie udało się sprawdzić statusu joba.");
      }

      const currentStatus = data.status;
      setStatus(currentStatus);

      if (currentStatus === "completed" || currentStatus === "success") {
        const details = await fetchJobDetails(currentPromptId);
        setJobDetails(details);
        setStatus("completed");
        return;
      }

      if (currentStatus === "failed" || currentStatus === "error") {
        const details = await fetchJobDetails(currentPromptId).catch(() => null);
        if (details) {
          setJobDetails(details);
        }
        throw new Error("Job zakończył się błędem.");
      }

      if (currentStatus === "cancelled") {
        throw new Error("Job został anulowany.");
      }

      await sleep(3000);
    }

    throw new Error("Przekroczono czas oczekiwania na wynik.");
  }

  function beginStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = maskCanvasRef.current;
    if (!canvas || !isEditorReady) return;

    const point = getCanvasPoint(canvas, event.clientX, event.clientY);
    drawingRef.current = true;
    lastPointRef.current = point;

    event.currentTarget.setPointerCapture(event.pointerId);
    drawSegment(canvas, point, point, brushMode, brushSize);
    if (brushMode === "paint") {
      setHasMask(true);
    }
  }

  function continueStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;

    const canvas = maskCanvasRef.current;
    const previousPoint = lastPointRef.current;

    if (!canvas || !previousPoint) return;

    const nextPoint = getCanvasPoint(canvas, event.clientX, event.clientY);
    drawSegment(canvas, previousPoint, nextPoint, brushMode, brushSize);
    lastPointRef.current = nextPoint;

    if (brushMode === "paint") {
      setHasMask(true);
    }
  }

  function endStroke(event?: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = maskCanvasRef.current;
    if (event) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore browsers that throw when pointer capture is already released.
      }
    }

    drawingRef.current = false;
    lastPointRef.current = null;

    if (canvas) {
      setHasMask(canvasHasMask(canvas));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tool.generateRoute) {
      setError("This tool is not connected yet.");
      return;
    }

    setError("");
    setPromptId("");
    setStatus("");
    setJobDetails(null);

    if (!sourceImage) {
      setError("Najpierw wybierz obraz bazowy.");
      return;
    }

    const maskCanvas = maskCanvasRef.current;

    if (!maskCanvas || !canvasHasMask(maskCanvas)) {
      setError("Zamaluj obszar do podmiany przed uruchomieniem inpaintu.");
      return;
    }

    try {
      setIsSending(true);

      const preparedImage = await buildMaskedInpaintImage(sourceImage, maskCanvas);

      const formData = new FormData();
      formData.append("image", preparedImage);
      formData.append("prompt", prompt);
      formData.append("seed", String(seed));
      formData.append("steps", String(steps));
      formData.append("guidance", String(guidance));
      formData.append("filenamePrefix", filenamePrefix);

      const response = await fetch(tool.generateRoute, {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as GenerateResponse;

      if (!response.ok || !data.ok) {
        throw new Error("error" in data ? data.error : "Nie udało się wysłać joba.");
      }

      setPromptId(data.promptId);
      setStatus("pending");

      await pollUntilFinished(data.promptId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-3 text-2xl font-semibold">Inpaint</h2>
        <p className="mb-6 text-zinc-400">
          Upload the source image, paint the area to replace, then generate the edited
          result. The red mask is only a preview for you — the exported mask is prepared
          automatically for the workflow.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-zinc-300">Source image</label>
            <input
              type="file"
              accept={(tool.accepts?.length ? tool.accepts : fallbackTool.accepts)?.join(",")}
              onChange={(event) => {
                setError("");
                setSourceImage(event.target.files?.[0] ?? null);
              }}
              className="block w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
            />
          </div>

          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-black/30 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setBrushMode("paint")}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  brushMode === "paint"
                    ? "bg-white text-black"
                    : "border border-zinc-700 bg-zinc-950 text-zinc-200"
                }`}
              >
                Paint mask
              </button>
              <button
                type="button"
                onClick={() => setBrushMode("erase")}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  brushMode === "erase"
                    ? "bg-white text-black"
                    : "border border-zinc-700 bg-zinc-950 text-zinc-200"
                }`}
              >
                Eraser
              </button>
              <button
                type="button"
                onClick={resetMaskCanvas}
                disabled={!isEditorReady}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-200 disabled:opacity-50"
              >
                Clear mask
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-zinc-300">
                Brush size
                <input
                  type="range"
                  min={8}
                  max={240}
                  step={1}
                  value={brushSize}
                  onChange={(event) => setBrushSize(Number(event.target.value))}
                  className="mt-2 w-full"
                />
                <span className="mt-1 block text-xs text-zinc-500">{brushSize}px</span>
              </label>

              <label className="block text-sm text-zinc-300">
                Mask preview opacity
                <input
                  type="range"
                  min={0.2}
                  max={0.95}
                  step={0.05}
                  value={maskOpacity}
                  onChange={(event) => setMaskOpacity(Number(event.target.value))}
                  className="mt-2 w-full"
                />
                <span className="mt-1 block text-xs text-zinc-500">
                  {Math.round(maskOpacity * 100)}%
                </span>
              </label>
            </div>

            {sourceImage ? (
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                  <span>
                    {canvasSize
                      ? `Canvas: ${canvasSize.width} × ${canvasSize.height}`
                      : "Preparing canvas..."}
                  </span>
                  <span>
                    {canvasSize
                      ? hasMask
                        ? "Mask ready"
                        : "Paint the area to replace"
                      : "Loading image"}
                  </span>
                </div>
                <div
                  className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
                  style={
                    canvasSize
                      ? { aspectRatio: `${canvasSize.width} / ${canvasSize.height}` }
                      : { minHeight: 320 }
                  }
                >
                  {!canvasSize ? (
                    <div className="absolute inset-0 grid place-items-center text-sm text-zinc-500">
                      Loading image editor...
                    </div>
                  ) : null}
                  <canvas
                    ref={baseCanvasRef}
                    className="absolute inset-0 h-full w-full"
                  />
                  <canvas
                    ref={maskCanvasRef}
                    className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
                    style={{ opacity: maskOpacity }}
                    onPointerDown={beginStroke}
                    onPointerMove={continueStroke}
                    onPointerUp={endStroke}
                    onPointerLeave={endStroke}
                    onPointerCancel={endStroke}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/40 p-8 text-sm text-zinc-500">
                Upload an image to open the in-browser mask painter.
              </div>
            )}

            <p className="text-xs leading-5 text-zinc-500">
              Paint the exact area that should be replaced. Use Eraser to refine edges.
              The rest of the image stays untouched.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">Prompt</label>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-zinc-300">Seed</label>
              <input
                type="number"
                value={seed}
                onChange={(event) => setSeed(Number(event.target.value))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-300">Steps</label>
              <input
                type="number"
                min={1}
                value={steps}
                onChange={(event) => setSteps(Number(event.target.value))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-zinc-300">Guidance</label>
              <input
                type="number"
                min={1}
                step="0.5"
                value={guidance}
                onChange={(event) => setGuidance(Number(event.target.value))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-300">Filename prefix</label>
              <input
                type="text"
                value={filenamePrefix}
                onChange={(event) => setFilenamePrefix(event.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSending || !sourceImage || !isEditorReady}
            className="rounded-xl bg-white px-5 py-3 font-medium text-black disabled:opacity-50"
          >
            {isSending ? "Generating..." : "Generate"}
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-3 text-2xl font-semibold">Job status</h2>

        <div className="space-y-3 text-sm text-zinc-300">
          <div>
            <span className="text-zinc-500">Prompt ID:</span> {promptId || "—"}
          </div>
          <div>
            <span className="text-zinc-500">Status:</span> {status || "idle"}
          </div>
          {error ? <div className="text-red-400">{error}</div> : null}
          {jobDetails?.execution_error ? (
            <pre className="overflow-auto rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-xs text-red-200">
              {JSON.stringify(jobDetails.execution_error, null, 2)}
            </pre>
          ) : null}
        </div>

        {tool.outputRoute ? (
          <ImageGalleryRenderer files={outputFiles} outputRoute={tool.outputRoute} />
        ) : null}

        {!outputFiles.length ? (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-700 bg-black/30 p-8 text-zinc-500">
            The finished inpaint images will appear here.
          </div>
        ) : null}
      </section>
    </div>
  );
}
