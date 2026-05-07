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

// ── Image model registry ───────────────────────────────────────────────────

export interface ImageModel {
  id: string;
  label: string;
  description: string;
  endpoint: string;
  supportsLora: boolean;
  /** cents per image at 1MP-equivalent */
  centsPerImage: number;
  /** credits (1cr = $0.01) */
  credits: number;
}

export const IMAGE_MODELS: ImageModel[] = [
  {
    id: "nano-banana",
    label: "Nano Banana",
    description: "Fastest · best value · great for iteration",
    endpoint: "fal-ai/nano-banana",
    supportsLora: false,
    centsPerImage: 4,
    credits: 4,
  },
  {
    id: "flux-schnell",
    label: "FLUX Schnell",
    description: "Fast · higher quality than Nano · LoRA ready",
    endpoint: "fal-ai/flux/schnell",
    supportsLora: true,
    centsPerImage: 3,
    credits: 3,
  },
  {
    id: "flux-dev",
    label: "FLUX Dev",
    description: "Best open model · portrait detail · LoRA ready",
    endpoint: "fal-ai/flux/dev",
    supportsLora: true,
    centsPerImage: 5,
    credits: 5,
  },
  {
    id: "flux-pro",
    label: "FLUX Pro",
    description: "Commercial quality · sharpest results",
    endpoint: "fal-ai/flux-pro",
    supportsLora: false,
    centsPerImage: 5,
    credits: 5,
  },
];

export const DEFAULT_IMAGE_MODEL = IMAGE_MODELS[0]; // nano-banana

// ── fal.ai image_size enum ─────────────────────────────────────────────────

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

export interface LoraWeight {
  /** HuggingFace repo path, CivitAI URL, or fal.ai storage URL */
  url: string;
  /** 0.0 – 1.0, defaults to 1.0 */
  scale?: number;
}

export interface GenerateImageParams {
  prompt: string;
  negativePrompt?: string;
  modelId?: string;
  aspectRatio?: string;
  numImages?: number;
  loras?: LoraWeight[];
  guidanceScale?: number;
  numInferenceSteps?: number;
  seed?: number;
  onProgress?: (pct: number) => void;
  /** Called with the seed used by fal.ai — useful for recording run lineage. */
  onSeed?: (seed: number) => void;
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

// ── Image generation ──────────────────────────────────────────────────────

export async function generateImage(params: GenerateImageParams): Promise<GeneratedImage[]> {
  const {
    prompt,
    negativePrompt,
    modelId = DEFAULT_IMAGE_MODEL.id,
    aspectRatio = "16:9",
    numImages = 1,
    loras,
    guidanceScale,
    numInferenceSteps,
    seed,
    onProgress,
    onSeed,
  } = params;

  const model = IMAGE_MODELS.find(m => m.id === modelId) ?? DEFAULT_IMAGE_MODEL;
  const imageSize = ASPECT_TO_SIZE[aspectRatio] ?? "landscape_16_9";

  // Build input — shape differs slightly between models
  const input: Record<string, unknown> = {
    prompt,
    image_size: imageSize,
    num_images: numImages,
    enable_safety_checker: true,
  };

  // LoRA injection — only FLUX models support it
  if (loras && loras.length > 0 && model.supportsLora) {
    input.loras = loras.map(l => ({ path: l.url, scale: l.scale ?? 1.0 }));
  }

  if (negativePrompt) input.negative_prompt = negativePrompt;
  if (guidanceScale !== undefined) input.guidance_scale = guidanceScale;
  if (numInferenceSteps !== undefined) input.num_inference_steps = numInferenceSteps;
  if (seed !== undefined) input.seed = seed;

  const result = await fal.subscribe(model.endpoint, {
    input,
    onQueueUpdate(update) {
      if (update.status === "IN_PROGRESS" && onProgress) {
        const last = update.logs?.at(-1)?.message ?? "";
        const match = last.match(/(\d+)%/);
        if (match) onProgress(parseInt(match[1]));
      }
    },
  });

  const data = result.data as FalImageResponse;
  if (data.seed !== undefined && onSeed) onSeed(data.seed);
  return data.images;
}

// ── Video generation ──────────────────────────────────────────────────────

// Video pricing (per second, billed by fal.ai):
//   Pika 2.2:    ~$0.05/s
//   Kling 2:     ~$0.07/s
//   Kling Pro:   ~$0.10/s
//   Sora 2:      ~$0.30/s (720p)
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
