import { supabase } from "./supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkflowConfig {
  masterFilename: string;
  positivePrompt: string;
  negativePrompt?: string;
  fluxModel?: string;
  clipL?: string;
  t5xxl?: string;
  vaeModel?: string;
  pulidModel?: string;
  weight?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  width?: number;
  height?: number;
}

type NodeRef = [string, number];
type ComfyNode = { class_type: string; inputs: Record<string, unknown> };
export type ComfyWorkflow = Record<string, ComfyNode>;

// ── Workflow builder ──────────────────────────────────────────────────────────

export function buildPuLIDWorkflow(config: WorkflowConfig): ComfyWorkflow {
  const {
    masterFilename,
    positivePrompt,
    fluxModel  = "flux1-dev.safetensors",
    clipL      = "clip_l.safetensors",
    t5xxl      = "t5xxl_fp8_e4m3fn.safetensors",
    vaeModel   = "ae.safetensors",
    pulidModel = "pulid_flux_v0.9.1.safetensors",
    weight     = 0.85,
    steps      = 20,
    seed       = Math.floor(Math.random() * 999999),
    width      = 1024,
    height     = 1024,
  } = config;

  const ref = (id: string, idx = 0): NodeRef => [id, idx];

  // FLUX + PuLID workflow — split loaders (FLUX Dev has no bundled CLIP/VAE)
  // 1  UNETLoader              → model
  // 2  DualCLIPLoader          → clip (clip_l + t5xxl)
  // 3  VAELoader               → vae
  // 4  LoadImage               → reference face image
  // 5  PulidEvaClipLoader      → eva_clip
  // 6  PulidModelLoader        → pulid
  // 7  PulidInsightFaceLoader  → face_analysis
  // 8  ApplyPulidAdvanced      → model with identity locked
  // 9  CLIPTextEncodeFlux      → positive conditioning
  // 10 FluxGuidance            → conditioning with guidance
  // 11 EmptyLatentImage        → blank latent
  // 12 KSampler                → latent (cfg=1 for FLUX)
  // 13 VAEDecode               → image
  // 14 SaveImage

  return {
    "1": {
      class_type: "UNETLoader",
      inputs: { unet_name: fluxModel, weight_dtype: "default" },
    },
    "2": {
      class_type: "DualCLIPLoader",
      inputs: { clip_name1: clipL, clip_name2: t5xxl, type: "flux" },
    },
    "3": {
      class_type: "VAELoader",
      inputs: { vae_name: vaeModel },
    },
    "4": {
      class_type: "LoadImage",
      inputs: { image: masterFilename },
    },
    "5": {
      class_type: "PulidEvaClipLoader",
      inputs: {},
    },
    "6": {
      class_type: "PulidModelLoader",
      inputs: { pulid_file: pulidModel },
    },
    "7": {
      class_type: "PulidInsightFaceLoader",
      inputs: { provider: "CPU" },
    },
    "8": {
      class_type: "ApplyPulidAdvanced",
      inputs: {
        model:         ref("1", 0),
        pulid:         ref("6", 0),
        eva_clip:      ref("5", 0),
        face_analysis: ref("7", 0),
        image:         ref("4", 0),
        weight,
        projection:    "ortho_v2",
        fidelity:      8,
        noise:         0.0,
        start_at:      0.0,
        end_at:        1.0,
      },
    },
    "9": {
      class_type: "CLIPTextEncodeFlux",
      inputs: {
        clip:     ref("2", 0),
        clip_l:   positivePrompt,
        t5xxl:    positivePrompt,
        guidance: 3.5,
      },
    },
    "10": {
      class_type: "FluxGuidance",
      inputs: {
        conditioning: ref("9", 0),
        guidance:     3.5,
      },
    },
    "11": {
      class_type: "EmptyLatentImage",
      inputs: { width, height, batch_size: 1 },
    },
    "12": {
      class_type: "KSampler",
      inputs: {
        model:        ref("8", 0),
        positive:     ref("10", 0),
        negative:     ref("9", 0),
        latent_image: ref("11", 0),
        seed,
        steps,
        cfg:          1.0,
        sampler_name: "euler",
        scheduler:    "simple",
        denoise:      1.0,
      },
    },
    "13": {
      class_type: "VAEDecode",
      inputs: { samples: ref("12", 0), vae: ref("3", 0) },
    },
    "14": {
      class_type: "SaveImage",
      inputs: {
        images:          ref("13", 0),
        filename_prefix: `plb_identity_${Date.now()}`,
      },
    },
  };
}

// ── Shot pack definitions ─────────────────────────────────────────────────────

export interface ShotDef {
  id: string;
  label: string;
  anglePrompt: string;
  aspectRatio: { w: number; h: number };
}

export const SHOT_PACK: ShotDef[] = [
  { id: "front",     label: "Front Portrait",  anglePrompt: "front-facing portrait, direct eye contact, neutral expression",        aspectRatio: { w: 1024, h: 1024 } },
  { id: "left",      label: "Left Profile",    anglePrompt: "left side profile, 90 degrees to camera, looking left",                aspectRatio: { w: 1024, h: 1024 } },
  { id: "right",     label: "Right Profile",   anglePrompt: "right side profile, 90 degrees to camera, looking right",              aspectRatio: { w: 1024, h: 1024 } },
  { id: "three_q",   label: "3/4 Angle",       anglePrompt: "three-quarter view, slight angle off-camera",                          aspectRatio: { w: 1024, h: 1024 } },
  { id: "full_body", label: "Full Body",        anglePrompt: "full body shot, head to toe, standing athletic pose",                  aspectRatio: { w: 832,  h: 1216 } },
  { id: "action",    label: "Action",           anglePrompt: "dynamic action pose, mid-movement, kinetic energy",                    aspectRatio: { w: 832,  h: 1216 } },
  { id: "smile",     label: "Smile",            anglePrompt: "warm confident smile, relaxed natural expression",                     aspectRatio: { w: 1024, h: 1024 } },
  { id: "intense",   label: "Intense",          anglePrompt: "intense focused expression, locked in, game face, determination",      aspectRatio: { w: 1024, h: 1024 } },
];

// ── Prompt builder ────────────────────────────────────────────────────────────

export function buildShotPrompt(
  shot: ShotDef,
  opts: { sport?: string; environment?: string; style?: string },
): string {
  const parts = [
    "photorealistic sports portrait",
    shot.anglePrompt,
    opts.sport     ? `${opts.sport} athlete` : "professional athlete",
    opts.environment ? opts.environment : "clean studio background",
    opts.style     ?? "dramatic cinematic lighting, sharp detail, professional photography",
  ];
  return parts.join(", ");
}

// ── ComfyUI API client helpers (all via proxy /admin/comfyui/*) ───────────────

async function adminHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Authorization": `Bearer ${session?.access_token ?? ""}`,
    "Content-Type":  "application/json",
  };
}

export async function comfyHealth(): Promise<boolean> {
  try {
    const headers = await adminHeaders();
    const res = await fetch("/admin/comfyui/health", { headers });
    return res.ok;
  } catch {
    return false;
  }
}

export async function comfyUploadImage(dataUrl: string): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const [header, b64] = dataUrl.split(",");
    const mimeType = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
    const res = await fetch("/admin/comfyui/upload", {
      method: "POST",
      headers: { "Authorization": `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: b64, mimeType, filename: `master_${Date.now()}.jpg` }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { ok: boolean; name?: string };
    return data.ok && data.name ? data.name : null;
  } catch {
    return null;
  }
}

export async function comfySubmitPrompt(workflow: ComfyWorkflow): Promise<string | null> {
  try {
    const headers = await adminHeaders();
    const res = await fetch("/admin/comfyui/prompt", {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt: workflow }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { ok: boolean; promptId?: string; error?: unknown; nodeErrors?: unknown };
    if (!data.ok) {
      console.error("[comfySubmitPrompt] rejected:", data.error, data.nodeErrors);
    }
    return data.ok && data.promptId ? data.promptId : null;
  } catch {
    return null;
  }
}

export async function comfyPollResult(promptId: string, timeoutMs = 120_000): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const headers = await adminHeaders();
      const res = await fetch(`/admin/comfyui/history/${promptId}`, { headers });
      if (!res.ok) continue;
      const hist = await res.json() as Record<string, unknown>;
      const entry = hist[promptId] as { outputs?: Record<string, { images?: Array<{ filename: string }> }> } | undefined;
      if (!entry?.outputs) continue;
      for (const node of Object.values(entry.outputs)) {
        if (node.images?.[0]?.filename) return node.images[0].filename;
      }
    } catch { /* keep polling */ }
  }
  return null;
}

export async function comfyFetchOutput(filename: string): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/admin/comfyui/view?filename=${encodeURIComponent(filename)}`, {
      headers: { "Authorization": `Bearer ${session?.access_token ?? ""}` },
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target!.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
