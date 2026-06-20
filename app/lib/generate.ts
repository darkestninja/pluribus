import { fal } from "@fal-ai/client";
import { supabase } from "./supabase";

// Proxy all fal.ai requests through our server, attaching the Supabase session
// token so the proxy can authenticate the request before forwarding to fal.run.
fal.config({
  proxyUrl: "/api/fal/proxy",
  requestMiddleware: async (request) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return request;
    return {
      ...request,
      headers: {
        ...(request.headers ?? {}),
        Authorization: `Bearer ${session.access_token}`,
      },
    };
  },
});

// ── fal storage upload ─────────────────────────────────────────────────────

/** Upload a base64 data URL to fal CDN via our server proxy. Returns the CDN URL. */
export async function uploadToFalCdn(dataUrl: string): Promise<string> {
  const [header, b64] = dataUrl.split(",");
  const mimeType = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/fal/upload", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session?.access_token ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageBase64: b64, mimeType }),
  });
  if (!res.ok) throw new Error(`Face upload failed: ${res.status}`);
  const data = await res.json() as { ok: boolean; url?: string; error?: string };
  if (!data.ok || !data.url) throw new Error(data.error ?? "Face upload failed");
  return data.url;
}

// ── Aspect ratio → image_size mapping ────────────────────────────────────

const ASPECT_TO_SIZE: Record<string, string> = {
  "1:1":  "square_hd",
  "4:5":  "portrait_4_3",
  "3:4":  "portrait_4_3",
  "2:3":  "portrait_16_9",
  "9:16": "portrait_16_9",
  "16:9": "landscape_16_9",
  "4:3":  "landscape_4_3",
  "3:2":  "landscape_4_3",
  "5:4":  "landscape_4_3",
  "21:9": "landscape_16_9",
};

// ── Video model registry ───────────────────────────────────────────────────

const VIDEO_MODEL_IDS: Record<string, string> = {
  pika:        "fal-ai/pika-v2.2/text-to-video",
  kling:       "fal-ai/kling-video/v2/master/text-to-video",
  "kling-pro": "fal-ai/kling-video/v2/pro/text-to-video",
  sora:        "fal-ai/sora",
};

// ── fal.ai response shapes ─────────────────────────────────────────────────

interface FalImageResponse {
  images: GeneratedImage[];
  seed?: number;
  has_nsfw_concepts?: boolean[];
}

interface FalVideoResponse {
  video?: GeneratedVideo;
  videos?: GeneratedVideo[];
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface GenerateImageParams {
  prompt: string;
  aspectRatio?: string;
  numImages?: number;
  seed?: number;
  onProgress?: (pct: number) => void;
  onSeed?: (seed: number) => void;
  /**
   * Subject face capture URLs for identity reference (face-close priority first).
   * Pass falCdnUrl values (already uploaded) or base64 dataUrls (uploaded on demand).
   * Only the first 4 are used — body shots are excluded upstream via NB_FACE_PRIORITY.
   */
  referenceImageDataUrls?: string[];
  /**
   * Wardrobe reference images (data URLs or CDN URLs). Passed after face refs in image_urls.
   * High priority — model is instructed to match the outfit exactly.
   * Max 2 wardrobe images used.
   */
  wardrobeImageUrls?: string[];
}

export interface GenerateVideoParams {
  prompt: string;
  model: "pika" | "kling" | "kling-pro" | "sora";
  duration?: number;
  aspectRatio?: string;
  onProgress?: (pct: number) => void;
}

export interface GeneratedImage {
  url: string;
  width: number;
  height: number;
}

export interface GeneratedVideo {
  url: string;
}

// ── Identity preservation ─────────────────────────────────────────────────
// Nano Banana Pro (Gemini 3 Pro) locks identity via:
//   1. image_urls: up to 4 face captures + up to 2 wardrobe images
//   2. Explicit preservation instruction prepended to prompt
//   3. negative_prompt excluding facial distortion patterns
// Optimal ref count is 2–6; beyond that fidelity plateaus and can degrade.

const IDENTITY_ONLY_PREFIX =
  "Preserve exact facial structure, eye shape, jawline, and skin texture from the reference image. " +
  "Realistic skin with visible pores and natural texture. " +
  "Same person as in the reference photos. " +
  "Ignore any clothing visible in the reference images — do not copy the reference outfit. " +
  "Default wardrobe: plain black t-shirt and black trousers, unless the prompt specifies different clothing. ";

// Kept for backward compat — alias
const IDENTITY_PRESERVATION = IDENTITY_ONLY_PREFIX;

function buildRefPrompt(faceCount: number, wardrobeCount: number): string {
  if (faceCount > 0 && wardrobeCount > 0) {
    const faceWord = faceCount === 1 ? "image" : `${faceCount} images`;
    const wardWord = wardrobeCount === 1 ? "image" : `${wardrobeCount} images`;
    return (
      `You have ${faceWord} of the subject's identity (first in the list) and ${wardWord} showing the target outfit (last in the list). ` +
      "IDENTITY REFERENCES: Preserve exact facial structure, eye shape, jawline, skin tone and texture. Same person must appear in the output. Ignore clothing from identity reference images. " +
      "WARDROBE REFERENCES (HIGH PRIORITY): Dress the subject in exactly the outfit shown in the wardrobe reference images — match garment type, colors, cut, fabric, and styling precisely. " +
      "Realistic skin with visible pores and natural texture. "
    );
  }
  if (faceCount > 0) return IDENTITY_ONLY_PREFIX;
  if (wardrobeCount > 0) {
    return (
      "Dress the subject in exactly the outfit shown in the reference wardrobe image. " +
      "Match garment type, colors, cut, fabric, and styling precisely. HIGH PRIORITY. "
    );
  }
  return "";
}

const IDENTITY_NEGATIVE =
  "different person, different face, changed identity, fat face, puffy cheeks, bloated jaw, " +
  "plastic skin, smooth skin, airbrushed, beauty filter, different ethnicity, different hair colour, " +
  "same clothing as reference, copying reference outfit, same outfit as reference photos";

const WARDROBE_NEGATIVE_EXTRA =
  "wrong outfit, different clothing style, naked, missing garment, different garment colors";

/** Skip re-upload if already a fal CDN URL; otherwise upload base64. */
async function ensureCdnUrl(urlOrData: string): Promise<string> {
  if (urlOrData.startsWith("https://")) return urlOrData;
  return uploadToFalCdn(urlOrData);
}

export async function generateImage(params: GenerateImageParams): Promise<GeneratedImage[]> {
  const {
    prompt,
    aspectRatio = "16:9",
    numImages = 1,
    seed,
    onProgress,
    onSeed,
    referenceImageDataUrls = [],
    wardrobeImageUrls = [],
  } = params;

  if (onProgress) onProgress(5);

  // Face refs (max 4) + wardrobe refs (max 2) — face refs go first in image_urls
  const faceRefs = referenceImageDataUrls.slice(0, 4);
  const wardRefs = wardrobeImageUrls.slice(0, 2);

  const [faceUrls, wardUrls] = await Promise.all([
    faceRefs.length > 0 ? Promise.all(faceRefs.map(ensureCdnUrl)) : Promise.resolve([]),
    wardRefs.length > 0 ? Promise.all(wardRefs.map(ensureCdnUrl)) : Promise.resolve([]),
  ]);
  const allRefUrls = [...faceUrls, ...wardUrls];

  if (onProgress) onProgress(10);

  const hasIdentity = allRefUrls.length > 0;
  const finalPrompt = hasIdentity
    ? buildRefPrompt(faceUrls.length, wardUrls.length) + prompt
    : prompt;

  const negPrompt = hasIdentity
    ? (wardUrls.length > 0 ? `${IDENTITY_NEGATIVE}, ${WARDROBE_NEGATIVE_EXTRA}` : IDENTITY_NEGATIVE)
    : undefined;

  const input: Record<string, unknown> = {
    prompt: finalPrompt,
    aspect_ratio: aspectRatio,
    num_images: numImages,
    ...(seed !== undefined ? { seed } : {}),
    ...(negPrompt ? { negative_prompt: negPrompt } : {}),
  };

  const modelId = hasIdentity ? "fal-ai/nano-banana-pro/edit" : "fal-ai/nano-banana-pro";
  if (hasIdentity) {
    input.image_urls = allRefUrls;
  }

  const result = await fal.subscribe(modelId, {
    input,
    onQueueUpdate(update) {
      if (update.status === "IN_PROGRESS" && onProgress) {
        const last = (update.logs as Array<{ message: string }> | undefined)?.at(-1)?.message ?? "";
        const m = last.match(/(\d+)%/);
        if (m) onProgress(10 + Math.round(parseInt(m[1]) * 0.88));
      }
    },
  });

  const data = result.data as FalImageResponse;
  if (data.seed !== undefined && onSeed) onSeed(data.seed);
  if (onProgress) onProgress(100);
  return data.images;
}

// ── Non-blocking queue submission ────────────────────────────────────────

export interface SubmitResult {
  requestId: string;
  modelId: string;
}

// Webhook URL: fal POSTs completion here so we detect it faster than polling.
// Uses the current page origin so it works on any deployment.
const WEBHOOK_URL = `${window.location.origin}/api/fal/webhook`;

/**
 * Submits a generation job to the fal queue without blocking.
 * Returns immediately with a requestId for polling.
 * Uploads face refs to CDN first (same as generateImage).
 */
export async function submitGeneration(params: GenerateImageParams): Promise<SubmitResult> {
  const {
    prompt,
    aspectRatio = "16:9",
    numImages = 1,
    seed,
    referenceImageDataUrls = [],
    wardrobeImageUrls = [],
  } = params;

  const faceRefs = referenceImageDataUrls.slice(0, 4);
  const wardRefs = wardrobeImageUrls.slice(0, 2);

  const [faceUrls, wardUrls] = await Promise.all([
    faceRefs.length > 0 ? Promise.all(faceRefs.map(ensureCdnUrl)) : Promise.resolve([]),
    wardRefs.length > 0 ? Promise.all(wardRefs.map(ensureCdnUrl)) : Promise.resolve([]),
  ]);
  const allRefUrls = [...faceUrls, ...wardUrls];
  const hasIdentity = allRefUrls.length > 0;
  const finalPrompt = hasIdentity
    ? buildRefPrompt(faceUrls.length, wardUrls.length) + prompt
    : prompt;

  const negPrompt = hasIdentity
    ? (wardUrls.length > 0 ? `${IDENTITY_NEGATIVE}, ${WARDROBE_NEGATIVE_EXTRA}` : IDENTITY_NEGATIVE)
    : undefined;

  const input: Record<string, unknown> = {
    prompt:       finalPrompt,
    aspect_ratio: aspectRatio,
    num_images:   numImages,
    ...(seed !== undefined ? { seed } : {}),
    ...(hasIdentity ? { image_urls: allRefUrls } : {}),
    ...(negPrompt ? { negative_prompt: negPrompt } : {}),
  };

  const modelId = hasIdentity ? "fal-ai/nano-banana-pro/edit" : "fal-ai/nano-banana-pro";
  const { request_id } = await fal.queue.submit(modelId, { input, webhookUrl: WEBHOOK_URL });
  return { requestId: request_id, modelId };
}

export interface PollStatus {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  progress: number;
}

/** Poll queue status for a submitted job. Returns parsed progress 0–100.
 *  Checks the proxy webhook cache first — if fal already POSTed the result
 *  we return COMPLETED immediately without an extra round-trip to fal. */
export async function pollGenerationStatus(modelId: string, requestId: string): Promise<PollStatus> {
  // Check proxy webhook cache first
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const cached = await fetch(`/api/fal/job-result?requestId=${encodeURIComponent(requestId)}`, {
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    });
    if (cached.ok) {
      const d = await cached.json() as { found: boolean; status?: string; images?: unknown[] };
      if (d.found && d.status === "COMPLETED") {
        return { status: "COMPLETED", progress: 100 };
      }
    }
  } catch { /* fall through to direct fal poll */ }

  const result = await fal.queue.status(modelId, { requestId, logs: true });
  let progress = 0;
  if (result.status === "IN_PROGRESS") {
    const logs = (result as unknown as { logs?: Array<{ message: string }> }).logs;
    const last = logs?.at(-1)?.message ?? "";
    const m = last.match(/(\d+)%/);
    if (m) progress = 10 + Math.round(parseInt(m[1]) * 0.88);
  } else if (result.status === "COMPLETED") {
    progress = 100;
  }
  return { status: result.status as PollStatus["status"], progress };
}

/** Fetch final result images once a job is COMPLETED.
 *  Uses webhook-cached payload when available to avoid an extra fal round-trip. */
export async function fetchGenerationResult(modelId: string, requestId: string): Promise<GeneratedImage[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const cached = await fetch(`/api/fal/job-result?requestId=${encodeURIComponent(requestId)}`, {
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    });
    if (cached.ok) {
      const d = await cached.json() as { found: boolean; images?: GeneratedImage[] };
      if (d.found && d.images?.length) return d.images;
    }
  } catch { /* fall through */ }

  const result = await fal.queue.result(modelId, { requestId });
  const data = result.data as FalImageResponse;
  return data.images ?? [];
}

// ── Video generation ──────────────────────────────────────────────────────

export async function generateVideo(params: GenerateVideoParams): Promise<GeneratedVideo> {
  const { prompt, model, duration = 5, aspectRatio = "16:9", onProgress } = params;

  const modelId = VIDEO_MODEL_IDS[model];
  if (!modelId) throw new Error(`Unknown video model: ${model}`);

  const result = await fal.subscribe(modelId, {
    input: { prompt, duration, aspect_ratio: aspectRatio },
    onQueueUpdate(update) {
      if (update.status === "IN_PROGRESS" && onProgress) {
        const last = update.logs?.at(-1)?.message ?? "";
        const match = last.match(/(\d+)%/);
        if (match) onProgress(parseInt(match[1]));
      }
    },
  });

  const data = result.data as FalVideoResponse;
  return (data.video ?? data.videos?.[0]) as GeneratedVideo;
}
