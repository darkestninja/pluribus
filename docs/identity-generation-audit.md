# Pluribus — Identity Lock & Image Generation Audit

**Last updated:** 2026-05-12 (original) / **Architecture sections updated:** 2026-06-20  
**Purpose:** Complete technical audit of the path from athlete uploads to generated image outputs. Written so you can understand every process, identify weaknesses, and make informed decisions about improvements.

---

> **⚠ ARCHITECTURE CHANGED — Sprint 14 (2026-05-14)**
>
> Sections 7 (Path A: LoRA), 8 (Path B: Two-Stage Pipeline), 9 (Path C: Standard), and 11 (LoRA Training) are **obsolete**. The three-path generation architecture was replaced with a single Nano Banana (NB / IP-Adapter) pipeline. No LoRA training, no FLUX img2img pass, no model registry.
>
> Current generation path: reference images → NB `fal-ai/nano-banana` → output. Identity comes from reference images passed as `reference_image_urls`, not from text prompts or fine-tuned weights.
>
> Additionally, the proxy now serves `/api/subject/*` routes for the talent portal (Sprint 13b), and the nginx config includes a `/api/subject/` location block with 20MB body limit.
>
> Read `app/lib/generate.ts` and `proxy.ts` for the current implementation. The sections below remain for historical reference only.

---

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [The Athlete Data Model](#2-the-athlete-data-model)
3. [Capture Layer — How Reference Images Enter the System](#3-capture-layer)
4. [Data Persistence — Where Everything Lives](#4-data-persistence)
5. [Prompt Construction Pipeline](#5-prompt-construction-pipeline)
6. [The Generation Decision Tree](#6-the-generation-decision-tree)
7. [Path A: LoRA Generation](#7-path-a-lora-generation)
8. [Path B: Two-Stage Identity Pipeline (No LoRA)](#8-path-b-two-stage-identity-pipeline)
9. [Path C: Standard Generation (No Identity)](#9-path-c-standard-generation)
10. [Identity Scoring — How We Measure Output Quality](#10-identity-scoring)
11. [LoRA Training Pipeline](#11-lora-training-pipeline)
12. [The Proxy Server](#12-the-proxy-server)
13. [Asset Storage & Mirroring](#13-asset-storage--mirroring)
14. [Known Weaknesses & Improvement Vectors](#14-known-weaknesses--improvement-vectors)
15. [Decision Log](#15-decision-log)

---

## 1. System Architecture Overview

```
Browser (React SPA)
      │
      │  All API calls go via nginx reverse proxy
      ▼
nginx (port 80)
  ├── /api/*       → pluribus-proxy (Bun, port 3333)
  ├── /assets      → static files
  └── /*           → /var/www/pluribus (built React app)

pluribus-proxy (Bun HTTP server)
  ├── Authentication layer (Supabase JWT verification)
  ├── /analyze/*        → Claude Haiku API (vision analysis, face scoring)
  ├── /fal/*            → fal.ai API (image generation — Nano Banana only)
  ├── /storage/*        → Supabase Storage (asset mirroring)
  ├── /review/*         → Supabase Postgres (external review tokens)
  ├── /canonical/*      → NB canonical validation + Claude Haiku scoring
  └── /api/subject/*    → SubjectPortal routes (no auth — token-gated)

External Services
  ├── fal.ai           — image/video generation, LoRA training, CDN storage
  ├── Supabase          — Postgres database + Storage bucket
  ├── Anthropic API     — Claude Haiku vision (face scoring, photo analysis)
  └── Resend            — transactional email
```

### Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript | Fast SPA, hot reload, strong typing |
| Styling | Tailwind CSS | Utility-first, design system tokens |
| HTTP proxy | Bun (TypeScript) | Fast runtime, native fetch, zero deps |
| Database | Supabase Postgres | Auth + DB + Storage in one service |
| Client state | localStorage + in-memory cache | Instant reads, no loading states; Supabase as write-through |
| AI generation | fal.ai SDK | Managed GPU queue, CDN, LoRA training |
| Vision analysis | Anthropic Claude Haiku | Accurate structural face comparison |
| Deploy | bash deploy.sh | `bun run build` → copy to `/var/www/pluribus` |

### Critical deploy note

`npm run build` writes to `/opt/pluribus/dist/`. The web server serves from `/var/www/pluribus/`. These are **different locations**. You must run `bash /opt/pluribus/deploy.sh` for changes to go live — running the build alone does nothing visible to users.

---

## 2. The Athlete Data Model

Two separate records describe every subject. Understanding the split is essential to understanding why identity does or doesn't carry through to outputs.

### Athlete (surface record)

Stored in the `subjects` Supabase table. Contains discoverable attributes:

```typescript
interface Athlete {
  id: string;
  name: string;
  sport: string;        // used for sport-specific action prompts
  event: string;
  status: "complete" | "pending" | "review";
  image: string;        // card thumbnail — NOT used for generation identity
  build?: string;       // "Lean sprinter build"
  skinTone?: string;    // "Medium brown"
  hair?: string;        // "Short black fade"
  age?: number;
  country?: string;
  height?: string;
  weight?: string;
}
```

The `image` field is the card thumbnail shown in the library. It is a low-res placeholder and is used only as a **last-resort fallback** for identity scoring — never passed to generation models directly.

### AthleteProfile (deep identity record)

Stored in `subject_profiles`. Contains everything needed for generation:

```typescript
// Current schema (Sprint 13 — LoRA fields removed in Sprint 14)
interface AthleteProfile {
  athleteId: string;
  captureAngles: CaptureAngle[];         // reference photos — passed to NB as reference_image_urls
  tattoos: TattooMark[];                 // visible marks (stored; not currently injected into NB prompts)
  doNotChange: string[];                 // subject constraints (stored; not currently injected)
  approvedLikeness: ApprovedLikeness[];  // vetted past outputs
  rejectedLikeness?: RejectedLikeness[]; // failed outputs (for reference)
  notes: string;
  portalToken?: string;                  // talent portal access token (Sprint 20)
  usageConsent?: UsageConsent;           // signed consent record (Sprint 20)
  collabTasks?: CollabTask[];            // onboarding task checklist (Sprint 20)
  identityScoringStatus?: {...};         // durable scoring state (Sprint 18)
}
// LoRA fields (loraUrl, loraStatus, loraJobId, loraTrainedAt, loraTriggerPhrase) REMOVED in Sprint 14
```

**Why the split?** The `Athlete` record is shared, lightweight, and displayed everywhere. The `AthleteProfile` is heavy (base64 images, training URLs) and only loaded when you open an athlete's capture tab. This prevents the entire athlete list from being slow to render.

### CaptureAngle

Each photo upload is stored as a `CaptureAngle`:

```typescript
interface CaptureAngle {
  key: AngleKey;       // "face-front" | "face-close" | "face-left" | "face-right" | "face-back"
                       // | "body-front" | "body-left" | "body-right" | "body-back"
  dataUrl: string;     // base64 data URL — stored in localStorage + Supabase JSONB
  uploadedAt: string;
  storageUrl?: string; // Supabase Storage signed URL (preferred for display)
  storagePath?: string;
}
```

---

## 3. Capture Layer

**File:** `app/components/AthleteLibrary.tsx`

### What gets captured

9 angle slots in two groups:

| Group | Angles | Used for generation? |
|---|---|---|
| Face | front, close, left, right, back | YES — all passed as reference images |
| Body | front, left, right, back | NO — excluded from generation and LoRA training |

**Why body shots are excluded from generation:**
Body shots contain clothing, posture, and environment — all of which change between campaigns. Passing them as identity references confuses the model: it tries to replicate the outfit and background, which overwrites the campaign creative direction. Only face geometry transfers cleanly across contexts.

**Why body shots are kept at all:**
For human reference during capture sessions, and as a completeness metric that tells the production team a subject is "fully captured." They don't influence AI output.

### The priority order

When selecting which face images to use for generation:

```
face-front → face-close → face-left → face-right → face-back
```

Front and close captures provide the most identity signal (full symmetry visible, no occlusion). Left and right fills in depth cues. Back is last because it shows nothing useful for face identity.

### Profile completeness scoring

`getProfileCompleteness()` in `store.ts` returns 0–100:

```
Athlete thumbnail photo:    10 pts
Sport assigned:             10 pts
Height on file:              5 pts
Weight on file:              5 pts
Physical attributes set:     5 pts
Capture angles (×9):        55 pts  (each angle ≈ 6.1 pts)
Approved likeness saved:    10 pts
────────────────────────────────
                           100 pts
```

Notes and do-not-change constraints are deliberately excluded from scoring — they're advanced fields that would penalise most subjects unfairly.

### Image compression

Before storage, every upload passes through `compressToDataUrl()` in `imageUtils.ts`. This resizes and JPEG-compresses to keep localStorage usage manageable. The trade-off is that very fine facial detail may be softened — acceptable because diffusion models work at ~512–1024px regardless of input resolution.

### Physical attribute inference

When you upload a capture photo, the system calls `POST /analyze/subject` on the proxy. Claude Haiku looks at the photo and returns:

```json
{ "build": "Lean sprinter build", "skinTone": "Medium brown", "hair": "Short black fade", "age": 26, "sport": "Swimming" }
```

These attributes are saved to the `Athlete` record and used in **text prompt construction** — they are not used for visual identity (that comes from the image references).

---

## 4. Data Persistence

### The three-layer model

```
Generation call
    ↓ reads from
In-memory cache (_cache object in store.ts)
    ↑ populated from
localStorage (keyed by user ID: plb_{userId}_*)
    ↑ hydrated/overridden from
Supabase Postgres (authoritative, server-side)
```

### initStore + hydrateStore

1. **`initStore(userId, email)`** — runs immediately on login. Builds `_cache` from localStorage synchronously. The app is usable instantly with no network wait.
2. **`hydrateStore(userId)`** — async. Fetches from all Supabase tables in parallel (`Promise.allSettled`). Where Supabase has data, it overwrites the cache. Where Supabase is empty and localStorage has data, it pushes localStorage to Supabase (one-time migration).

### Write-through

Every mutation (save athlete, save profile, add output) calls both:
- `localStorage.setItem(...)` — instant, synchronous
- Supabase `.upsert(...)` — async, fire-and-forget

If Supabase is unreachable, the local write succeeds and the data will be pushed on next hydration.

### AthleteProfile storage

Profiles are stored in the `subject_profiles` table. The `capture_angles` field is a Postgres JSONB column containing the full `CaptureAngle[]` array including base64 data URLs. This means:

- Base64 images live in Supabase JSONB — there is no separate image storage for captures
- For display, the `storageUrl` (Supabase Storage signed URL) is preferred if set — but generation always uses the `dataUrl` (base64) directly

**Why not store captures in Supabase Storage?** They're uploaded via `uploadFile()` in `storage.ts` for permanent archiving, but the `dataUrl` is kept as the primary reference so generation works offline or if the signed URL expires.

---

## 5. Prompt Construction Pipeline

**File:** `app/lib/promptEnhancer.ts`

### The four building blocks

Every generated image prompt is assembled from up to four layers:

```
[1] Base prompt (from Recipe or Campaign Recipe)
      +
[2] Subject injection (athlete descriptor + sport action)
      +
[3] Creative modifiers (look, mood, camera style, tone)
      +
[4] Quality tail (editorial anti-AI signals)
```

### Layer 1: Base prompt

Comes from one of three sources depending on what's selected in the UI:

| Source | What it provides |
|---|---|
| Classic Recipe | `recipe.prompt` — a single-line creative direction |
| Campaign Recipe | Structured multi-field recipe (subject, setting, lighting, etc.) built via `buildCampaignRecipePrompt()` |
| Custom notes | Free-text from the user, optionally enhanced via `handleEnhance()` |

### Layer 2: Subject injection

`buildAthleteDescriptor()` builds a text description from the `Athlete` record:

```
"elite swimming athlete, lean sprinter build, medium brown complexion, short black fade hair, approximately 26 years old, representing Australia"
```

Appended as: `Subject: {name}, {descriptor}`

**Sport action:** A random sport-specific action is appended from `SPORT_ACTIONS`:

```typescript
const SPORT_ACTIONS = {
  Swimming: ["explosive freestyle sprint at peak stroke", "powerful butterfly pull through water", ...],
  Track: [...],
  Weightlifting: [...],
};
```

**Why random actions?** To prevent the model from locking onto a single pose across all outputs for the same athlete. Creates visual variety while keeping the sport context relevant.

### Layer 3: Creative modifiers

```typescript
const LOOK_MODIFIERS = {
  "B&W":    "black and white, monochrome, high-contrast silver gelatin film aesthetic",
  "Chrome": "vibrant chromatic colour, punchy saturation, film-like tones",
  "Colour": "rich editorial colour grade, warm golden highlights, deep rich shadows",
  "Matte":  "matte desaturated film tones, soft contrast, cinematic grade",
  "Vivid":  "hyper-vivid saturated colour, electric tones, commercial sports grade",
};
```

Mood, camera style, and tone from the Campaign Recipe are injected as: `Visual direction: {mood} mood, {camera} camera, {tone} tone`.

**Identity constraints** from the profile (do-not-change rules + visible tattoo descriptions) are injected as: `Identity constraints: preserve tattoo on left forearm; do not change hair colour`.

**Why inject constraints as text?** Diffusion models understand semantic negation poorly — they often ignore `no` and `not`. Framing constraints as `preserve:` or `identity constraint:` is more reliable because it turns the constraint into a positive directive rather than a negative one.

### Layer 4: Quality tail

```
studio portrait photography, editorial aesthetic, one directional key light only, no fill light, no rim light, natural skin texture, no beauty retouching, no smoothing, 85mm full-frame portrait perspective, physically achievable studio lighting, not commercial, not lifestyle, not fashion-led, photographic realism, shot on Phase One IQ4 150MP, no watermark, no text overlay
```

**Why these specific tokens:**

| Token | Effect |
|---|---|
| `one directional key light only` | Constrains the model to physically real lighting. Multiple light sources create impossible shadows — a primary tell of AI generation |
| `natural skin texture, no beauty retouching, no smoothing` | Fights the model's default "beauty mode" that produces plasticky skin |
| `85mm full-frame portrait perspective` | Implies appropriate depth-of-field and perspective compression — prevents ultra-wide distortions |
| `shot on Phase One IQ4 150MP` | Camera model tokens bias the model toward high-resolution medium-format aesthetics |
| `not commercial, not lifestyle, not fashion-led` | Steers away from the generic stock-photo look that dominates FLUX's training data |
| `photographic realism` | Counteracts illustration and CGI biases |

### The negative prompt

```
commercial photography, lifestyle, fashion editorial, digital painting, compositing, beauty retouching, smooth skin, multiple light sources, rim light, fill light flattening, AI-looking, plastic skin, oversaturated, HDR, illustration, graphic design, CGI
```

Negative prompts list things the model should actively de-weight. These mirror the quality tail — each positive token has a negative counterpart to reinforce the signal from both directions.

### Prompt sanitisation for diffusion

**File:** `generate.ts` → `sanitizePromptForDiffusion()`

When prompts come from Campaign Recipes or user input, they often contain formatting that's useful for reading but harmful for diffusion models:

- ALL-CAPS section headers (`LIGHTING SYSTEM (CONSISTENT CHARACTER)`)
- Imperative constraint language (`forbidden`, `must not`, `do not`)
- Bullet-point rule lists

Diffusion models read prompts as **token bags** — every token gets equal weight regardless of whether it's a visual descriptor or a meta-instruction. A prompt with 30% instruction tokens wastes 30% of the context window and pushes actual visual descriptors past the attention cutoff.

`sanitizePromptForDiffusion()` strips these patterns and collapses the result to a comma-separated visual descriptor string before passing to any model.

---

## 6. The Generation Decision Tree

**File:** `app/lib/generate.ts` → `generateImage()`

Every generation call follows this routing logic:

```
generateImage(params)
      │
      ├── loraUrl present?
      │     YES → Path A: LoRA generation (flux/dev + trained weights)
      │
      ├── referenceImageDataUrls present and length > 0?
      │     YES → Path B: Two-stage identity pipeline (Nano Banana → FLUX img2img)
      │
      └── neither → Path C: Standard generation (selected model, no identity)
```

**When is loraUrl present?**
When the athlete's profile has `loraStatus === "ready"` and a `loraUrl`. The Workspace checks:

```typescript
loraUrl: profile?.loraStatus === "ready" ? profile.loraUrl : undefined,
```

**When are referenceImageDataUrls present?**
When `loraUrl` is NOT set AND `getFaceDataUrls(profile)` returns at least one face capture. Path B is the fallback identity path when LoRA isn't trained yet.

**Mutual exclusivity:** `referenceImageDataUrls` is only passed when there's no `loraUrl`:

```typescript
referenceImageDataUrls: (!profile?.loraUrl && refDataUrls.length > 0) ? refDataUrls : undefined,
```

If LoRA is ready, the two-stage pipeline is skipped entirely.

---

## 7. Path A: LoRA Generation

**Use case:** Athlete has a trained LoRA model. Highest identity fidelity (~90%+ match on structural geometry).

### What happens

1. Prompt is sanitised via `sanitizePromptForDiffusion()`
2. Trigger phrase is prepended: `james_magnussen_person, {sanitised prompt}`
3. `fal-ai/flux/dev` is called with:
   - `loras: [{ path: loraUrl, scale: 1.0 }]`
   - `num_inference_steps: 28` (default)
   - `guidance_scale: 3.5` (default)
   - `enable_safety_checker: true`

### Why FLUX dev specifically for LoRA?

FLUX dev is the model the LoRA was trained on (`fal-ai/flux-lora-portrait-trainer` targets FLUX dev weights). The LoRA weights encode delta adaptations relative to specific layer activations of that exact model. Running a LoRA trained on FLUX dev through FLUX schnell or FLUX pro would produce degraded or garbage output because the activation distributions are different.

### What the trigger phrase does

The trigger phrase (`james_magnussen_person`) is a token that, during LoRA training, was always present in the training image captions. The model learned to associate this token with the visual features of the specific person. At inference time, including this token "activates" those features. Without it, the LoRA weights are still applied but weakly — the model doesn't know which subject to inject.

**Why underscore-separated, no spaces?** Tokenizers may split multi-word phrases: "james magnussen person" becomes three separate tokens. `james_magnussen_person` is typically treated as a single token, creating a cleaner, stronger association during training and inference.

### LoRA scale

Set to `1.0` — full strength. Values below 1.0 would blend the LoRA identity with the base model's output. For maximum identity lock, full scale is correct.

---

## 8. Path B: Two-Stage Identity Pipeline

**Use case:** No LoRA trained yet. Athlete has face captures. Medium identity fidelity (~65–78% structural match).

This path uses **reference images** — actual photos of the subject — to guide the model toward that person's appearance.

### Why two stages?

No single model perfectly solves both "look like this person" and "look like editorial photography." The best available models specialise:

- **Nano Banana** (`fal-ai/nano-banana`): IP-adapter-based multi-reference identity conditioning. Fast, accepts multiple face images simultaneously, good at locking facial structure. Weak on editorial rendering quality.
- **FLUX dev img2img** (`fal-ai/flux/dev/image-to-image`): Exceptional at editorial rendering, photographic quality, creative direction. No native identity conditioning.

The two-stage approach uses each model for what it does best:

```
Stage 1 (Nano Banana):  "Create an image that looks like THIS PERSON doing X"
                             → Identity geometry is established in the draft

Stage 2 (FLUX img2img): "Take this draft and re-render it with editorial quality"
                             → Photo quality added while geometry is preserved
```

### Stage 1 — Nano Banana identity pass

```typescript
fal.subscribe("fal-ai/nano-banana", {
  input: {
    prompt: cleanPrompt,
    reference_image_url: refUrls[0],   // primary reference
    reference_image_urls: refUrls,     // all references for multi-ref conditioning
    image_size: imageSize,
    num_images: numImages,
    enable_safety_checker: true,
  },
});
```

**Why pass all face references simultaneously?**
Multi-reference conditioning averages the identity signal across all provided images. A single photo may have shadows, angles, or expressions that bias the output. Providing front, close, left, and right views allows the IP-adapter to extract a more complete identity representation that isn't skewed by any one image's conditions.

**Progress scaling:** Nano Banana progress is mapped to 8–45% of the overall bar. The first 8% is consumed by uploading the reference images to fal CDN.

### Stage 2 — FLUX editorial pass

```typescript
fal.subscribe("fal-ai/flux/dev/image-to-image", {
  input: {
    image_url: draft.url,     // Stage 1 output URL (hosted on fal CDN)
    prompt: cleanPrompt,
    strength: 0.60,           // how much to change vs. preserve
    num_inference_steps: 28,
    guidance_scale: 3.5,
    enable_safety_checker: true,
  },
});
```

**The `strength: 0.60` parameter — this is critical:**

Img2img works by adding noise to the input image and then denoising it with the prompt as guidance. Strength controls how much noise is added:

| Strength | Effect |
|---|---|
| 1.0 | Full noise → output completely re-imagined (ignores the input) |
| 0.0 | No noise → output identical to input (ignores the prompt) |
| 0.60 | 60% noise → keeps low-frequency geometry (face structure, proportions), regenerates fine detail (lighting, texture, colour) |

At 0.60, the facial structure from Nano Banana is preserved because it's encoded in low spatial frequencies. High-frequency details (pores, lighting specular, fabric texture) are regenerated by FLUX for editorial quality.

**Why not lower strength (e.g. 0.40)?** Lower strength produces output that looks like a JPEG re-compression of the Nano Banana draft — you lose the editorial rendering uplift. 0.60 is the empirical sweet spot where structure holds and quality improves.

**Progress scaling:** FLUX progress is mapped to 48–95% of the overall bar.

### Reference image upload flow

The browser cannot PUT directly to fal's Google Cloud Storage pre-signed URLs — browsers enforce CORS and GCS doesn't allow wildcard origins on authenticated uploads. The flow is:

```
Browser
  → POST /api/fal/upload (base64 JSON body)
  → proxy: POST fal CDN /storage/upload/initiate → receives {upload_url, file_url}
  → proxy: PUT bytes to upload_url (GCS, server-to-server, no CORS restriction)
  → proxy: return file_url to browser
  → browser passes file_url to Nano Banana as reference_image_url
```

---

## 9. Path C: Standard Generation

**Use case:** No face captures, or user explicitly selects a model for non-identity generation.

### Available models

| Model | fal endpoint | Supports LoRA | Best for |
|---|---|---|---|
| nano-banana | `fal-ai/nano-banana` | No | Rapid composition checks |
| flux-schnell | `fal-ai/flux/schnell` | Yes | Fast review rounds |
| flux-dev | `fal-ai/flux/dev` | Yes | Standard quality (default) |
| flux-pro | `fal-ai/flux-pro` | No | Final delivery |

The prompt is passed as-is (no sanitisation — the quality tail and negative prompt carry the editorial signal).

### Style LoRA injection

The standard path supports injecting campaign-level style LoRAs (separate from the subject LoRA):

```typescript
if (loras && loras.length > 0 && model.supportsLora) {
  input.loras = loras.map(l => ({ path: l.url, scale: l.scale ?? 1.0 }));
}
```

Only FLUX models support LoRA injection (`supportsLora: true`). nano-banana and flux-pro don't support external LoRA weights.

---

## 10. Identity Scoring

**Files:** `app/lib/faceScore.ts`, `proxy.ts → /analyze/face-compare`

After every image generation, the system computes an identity resemblance score displayed as "% identity" on each output and saved to `CampaignOutput.resemblanceScore`.

### What is being scored

Structural facial geometry — things that don't change between sessions:

- Skull shape and overall facial proportions
- Inter-eye distance and eye shape/set
- Nose bridge width and tip shape
- Jaw angle and chin projection
- Cheekbone position
- Lip geometry

**What is explicitly ignored:**
Lighting, colour, contrast, pose, expression, hair colour/style, clothing, age presentation.

### How it works

```
Workspace.tsx:
  scoreUrls(urls, scoreRef)
    → computeResemblanceScore(referenceUrl, generatedUrl)
      → compareFaces(referenceUrl, generatedUrl)
        → POST /analyze/face-compare (proxy)
          → Claude Haiku vision model
            → returns { score, confidence, keyMatches, keyDifferences }
```

### The reference image

```typescript
const scoreRef = getFaceDataUrls(getAthleteProfile(athlete.id))?.[0] ?? athlete.image;
```

Priority: best face capture (`face-front`) → fallback to athlete card thumbnail.

### Claude Haiku prompt calibration

```
85-100: Clearly the same person, strong structural match
65-84:  Probable same person, most features align
45-64:  Ambiguous — some features match, others don't
25-44:  Probably different person
0-24:   Clearly different people
```

The boundaries are calibrated toward strictness. A score of 75 means "probably the same person" — not certainty.

### Score interpretation

| Score | Meaning | Recommended action |
|---|---|---|
| 85–100 | Strong identity lock | Safe to approve |
| 65–84 | Probable match | Human review recommended |
| 45–64 | Ambiguous | Regenerate or reject |
| 0–44 | Wrong person | Reject, check reference images |

### Historical failure — grayscale histogram scoring

The original scoring system used OpenCV Haar cascade face detection + grayscale histogram correlation. This measured brightness distribution similarity, not facial geometry. Two different people photographed under similar lighting could score 87% because their luminance histograms were similar. Completely misleading — replaced with Claude Haiku structural vision comparison.

---

## 11. LoRA Training Pipeline

**Files:** `app/components/AthleteLibrary.tsx`, `proxy.ts → /fal/train`

A LoRA (Low-Rank Adaptation) is a small set of fine-tuning weights layered on top of the base FLUX dev model. It teaches the model "when you see the token `james_magnussen_person`, render a face that looks like this specific person." Once trained, it produces consistently high identity fidelity regardless of the prompt content.

### Training flow

```
Browser (AthleteLibrary):
  1. Filter face captures (front, close, left, right — 2 best by priority order)
  2. Calculate steps: min(captures × 100, 400), minimum 200
  3. Build { images: [{base64, filename}], triggerWord, steps }
  4. POST /api/fal/train

Proxy:
  5. Build ZIP from base64 images (fflate — server-side, no browser blocking)
  6. Upload ZIP to fal CDN storage (initiate → PUT, same flow as reference upload)
  7. POST to fal queue: fal-ai/flux-lora-portrait-trainer
     Parameters:
       - trigger_phrase: "james_magnussen_person"
       - steps: 200-400
       - subject_crop: true
       - multiresolution_training: false
       - rank: 8
  8. Return { requestId } to browser

Browser:
  9. Save loraStatus: "training", loraJobId to AthleteProfile
  10. Start polling GET /api/fal/train/status every 30s
  11. On complete: save loraUrl, loraStatus: "ready", loraTriggerPhrase to profile
  12. Auto-resume polling if user navigates away and returns
```

### Training parameter decisions

| Parameter | Value | Why |
|---|---|---|
| `subject_crop: true` | true | Automatically crops each training image to the face region. Prevents the model from overfitting to background, clothing, or props. Essential for portrait LoRA |
| `multiresolution_training` | false | Disabled — trains at single resolution, ~25-30% faster. Multi-resolution helps general-purpose models but adds time without meaningfully improving portrait identity fidelity at low step counts |
| `rank: 8` | 8 | LoRA rank controls the number of trainable parameters. Default is 16. Rank 8 = half the parameters = ~20-30% faster training. Portrait LoRA doesn't need high rank because faces have lower intrinsic dimensionality than general scenes |
| `steps` | 200–400 | 100 steps per image, capped at 400. Too few → underfitting (identity not learned). Too many → overfitting (model ignores prompts, generates a caricature). 200–400 is the sweet spot for 2 face images |
| Image count | 2 best | Front + close. More images don't significantly improve identity lock at low step counts — they increase training time linearly |

### Trigger word format

```typescript
const triggerWord = athlete.name.toLowerCase().replace(/\s+/g, "_") + "_person";
// "James Magnussen" → "james_magnussen_person"
```

**Why `_person` suffix?** The tokenizer may already know `james` and `magnussen` from its training data (celebrity names are common on the internet). Adding `_person` makes the full compound token more distinctive and less likely to be conflated with how the base model already represents these tokens individually.

**Why underscores, not spaces?** Tokenizers typically treat space-separated words as independent tokens. `james_magnussen_person` is more likely to tokenize as a single unit, creating a cleaner identity trigger.

### Training time estimates

At current settings (2 images, 200–400 steps, rank 8, no multiresolution):
- Expected: **2–4 minutes**
- Previous settings (4 images, 600–1500 steps, rank 16, multiresolution): 8–12 minutes

### Auto-resume polling

A `useEffect` in `AthleteLibrary.tsx` detects `profile.loraStatus === "training"` on mount and automatically resumes 30s polling. This prevents "orphaned" training jobs that complete while the user has navigated away from the capture page.

### LoRA storage

The trained LoRA `.safetensors` file is stored on fal's CDN. The URL is saved to `profile.loraUrl`. This URL is permanent — it doesn't expire. The file is not copied to Supabase Storage (it's large and only needed at inference time by fal's infrastructure).

---

## 12. The Proxy Server

**File:** `/opt/pluribus-proxy/proxy.ts`
**Runtime:** Bun (single-file HTTP server, port 3333, loopback-only bind)
**Process management:** systemd (`pluribus-proxy.service`)

### Why a proxy exists

1. **API key security** — `FAL_KEY`, `ANTHROPIC_API_KEY`, `RESEND_KEY` cannot be in the browser
2. **Authentication gate** — every request is JWT-verified against Supabase before hitting external APIs
3. **CORS bypass** — fal CDN storage PUT requires server-to-server calls; browsers are blocked by CORS
4. **fal SDK proxy** — the fal SDK's `proxyUrl: "/api/fal/proxy"` setting routes all SDK calls through the proxy, which verifies the Supabase token before forwarding

### Authentication pattern

Every protected endpoint:

```typescript
const user = await getAuthedUser(req);
if (!user) return json({ ok: false, error: "Unauthorized" }, 401, cors);
```

`getAuthedUser()` extracts the `Bearer` token from the `Authorization` header and calls `supabase.auth.getUser(token)`. The Supabase auth server is the authority — no additional secret needed.

### Endpoint map

| Endpoint | Method | Purpose |
|---|---|---|
| `/auth/signup` | POST | Create user + send welcome email via Resend |
| `/analyze/face-compare` | POST | Claude Haiku structural face identity score |
| `/analyze/subject` | POST | Claude Haiku physical attribute inference from photo |
| `/analyze/garment` | POST | Claude Haiku garment description for wardrobe prompts |
| `/analyze/moodboard` | POST | Claude Haiku creative direction extraction from images |
| `/fetch/url` | POST | Server-side image fetch (Pinterest, Behance — bypasses CORS) |
| `/fal/proxy` | ALL | fal.ai SDK proxy (forwards SDK calls to fal.run) |
| `/fal/upload` | POST | Upload reference image to fal CDN |
| `/fal/train` | POST | Start LoRA training job |
| `/fal/train/status` | GET | Poll training job status |
| `/storage/mirror` | POST | Mirror fal CDN asset to Supabase Storage |
| `/review/create` | POST | Generate shareable review link token |
| `/review/:token` | GET | Read-only campaign view for external reviewers |

### Claude Haiku usage

The proxy calls the Anthropic API directly (raw HTTP fetch, not SDK). Haiku is used instead of Sonnet or Opus because:
- These are high-volume calls (one per generated image for scoring)
- Haiku is 10–20× cheaper per token
- The tasks (face comparison, attribute extraction) are visual matching, not complex reasoning

---

## 13. Asset Storage & Mirroring

### fal CDN (temporary)

Every generated image URL from fal.ai (e.g. `https://fal.run/files/...`) is temporary — typically 24–72 hours before the file is deleted. If you add an output to a campaign and don't mirror it, the image will 404 shortly after.

### Supabase Storage (permanent)

After every generation, if the user adds the output to a campaign, `mirrorAsset()` is called non-blocking:

```typescript
mirrorAsset(url, path).then(mirrored => {
  if (mirrored?.signedUrl) {
    updateCampaignOutput(outputId, { url: mirrored.signedUrl, storagePath: mirrored.path });
  }
});
```

The mirror flow:

```
Browser calls mirrorAsset(falUrl, "athlete_id/output_id.jpg")
  → POST /storage/mirror to proxy
  → proxy fetches falUrl bytes (server-to-server, no CORS issue)
  → proxy uploads to Supabase Storage bucket "pluribus-assets-private"
  → creates 1-year signed URL
  → returns { path, signedUrl }
  → browser patches CampaignOutput.url to the signed URL
```

The `originalFalUrl` field is kept in the record for debugging, but `url` is updated to the permanent signed URL.

### Signed URL expiry

Signed URLs expire after 1 year. There is no automatic refresh mechanism — when a URL expires, the image will 404. The `storagePath` field contains enough information to regenerate a new signed URL from Supabase Storage when needed.

---

## 14. Known Weaknesses & Improvement Vectors

### 14.1 Identity lock

**Two-stage pipeline is a weak fallback without LoRA**
Nano Banana's IP-adapter identity conditioning works best for distinctive faces. Faces with average proportions may drift toward the model's "average attractive person" prior. The two-stage pipeline is a stopgap — train LoRA for every athlete as the first action after capture, before any generation.

**LoRA identity degrades with extreme creative directions**
Very unusual prompts (extreme fantasy settings, non-human environments) can cause the LoRA to under-express. The model tries to satisfy both the strong creative direction and the identity constraint — identity usually loses.
*Improvement:* Keep `guidance_scale` at 3.5 or below. Higher guidance scale amplifies the prompt at the expense of the LoRA's learned prior.

**No multi-angle identity at training time**
LoRA training currently uses 2 face images. More angles would give the model a more complete 3D understanding of the face, improving identity at non-frontal poses.
*Improvement:* Test 3–4 images with the same low step count and measure identity score at 45°+ angles.

### 14.2 Prompt quality

**Prompt sanitiser may over-strip**
The `sanitizePromptForDiffusion()` regex strips any line matching an ALL-CAPS pattern 8+ characters long. Some Campaign Recipe fields may legitimately use short capitalised labels that get incorrectly stripped.
*Improvement:* Require 12+ characters for the ALL-CAPS pattern, or only strip lines that are exclusively ALL-CAPS with no lowercase letters.

**Identity constraints as text are unreliable**
Text like `Identity constraints: preserve tattoo on left forearm` is processed as a token bag. Diffusion models have no concept of "constraint" — they weight `tattoo`, `forearm`, `preserve` as equal positive tokens. This sometimes backfires.
*Improvement:* Move tattoo constraints to the negative prompt as `no tattoo` when the athlete doesn't have one, and as a strong positive in the main prompt body when they do.

### 14.3 Scoring

**Claude Haiku scores add latency at scale**
Each face comparison is a Haiku API call with two image attachments. For batch generation (10+ images) this adds significant latency.
*Improvement:* Cache the reference image's base64 on the proxy (keyed by athlete ID + profile version) so it doesn't need to be fetched from Supabase on every score request.

**Score is computed against only one reference**
The front-face capture is used as the scoring reference. If the output shows a 3/4 angle and the reference is front-on, structural features look different even for the same person — lowering the score artificially.
*Improvement:* Run scoring against all available face captures and return the maximum score.

**Scores don't gate approval**
The score is displayed but doesn't block approval or trigger automatic rejection. Low-scoring outputs can be silently approved.
*Improvement:* Add a configurable threshold (e.g. 65) below which outputs are automatically flagged as `needs_revision`.

### 14.4 Infrastructure

**Base64 images in Supabase JSONB**
Capture angles store their data as base64 inside a JSONB column. A fully-captured athlete profile (5 face + 4 body captures) can be 1–5 MB of JSONB. Fine for tens of athletes, will be slow at hundreds.
*Improvement:* Move base64 storage to Supabase Storage, store only `storagePath` in the JSONB column. Fetch only when needed.

**Signed URL expiry for generated outputs**
1-year Supabase Storage signed URLs are not refreshed automatically. Old campaign outputs will 404 after expiry.
*Improvement:* On each `hydrateStore()`, check if signed URLs are within 30 days of expiry and refresh them silently.

**LoRA weights not backed up**
The trained LoRA `.safetensors` file lives only on fal CDN. If fal deletes it (no published retention policy), the LoRA is gone and the athlete must be retrained.
*Improvement:* After training completes, download and mirror the `.safetensors` file to Supabase Storage.

---

## 15. Decision Log

A record of why the current approach was chosen over alternatives that were tried.

### Face-swap post-processing → removed

**What tried:** After LoRA or two-stage generation, run `fal-ai/face-swap` to transplant the athlete's face onto the output.
**Why tried:** Seemed like a way to combine LoRA pose quality with a direct face transplant for maximum identity.
**Why removed:** Face swap creates visible seam artifacts at the hairline and jaw. Identity scores dropped from ~78% to ~60% because the compositing boundary was clearly detectable. The LoRA identity was being overwritten by the swap. Removed entirely — the LoRA and two-stage pipeline produce cleaner identity without post-processing seams.

### PuLID → replaced by two-stage Nano Banana + FLUX pipeline

**What tried:** `fal-ai/flux-pulid` — PuLID attention injection to lock face identity during FLUX generation using a single reference image.
**Why replaced:** PuLID accepts only one reference image. Multi-angle conditioning (the strongest available signal) wasn't possible. Nano Banana's multi-reference IP-adapter provides stronger average identity signal. Additionally, the `guidance_scale` was mistakenly clamped to 1.5 during PuLID testing (see below), which suppressed both the identity and the creative direction simultaneously.

### `guidance_scale: 1.5` clamped → removed

**What happened:** A 422 error from a different model was mistakenly applied as a constraint: `Math.min(guidanceScale ?? 4, 1.5)`.
**Effect:** PuLID's valid range is 1.0–10.0 (default 4.0). Clamping to 1.5 severely underweighted the prompt, producing washed-out outputs with weak creative direction. Identity was also weak because the IP-adapter needs some prompt guidance to place the face in the right context.
**Fix:** Removed the clamp entirely.

### Grayscale histogram scoring → replaced by Claude Haiku

**What tried:** OpenCV Haar cascade face detection + grayscale histogram correlation. Computed inside a Python microservice.
**Why it failed:** Histogram correlation measures luminance distribution, not face geometry. Two different people in similar lighting scored 87% because their brightness distributions were similar. The score was decorative rather than diagnostic.
**Replaced with:** Claude Haiku structural face geometry comparison, calibrated against identity features (skull shape, eye set, jaw angle, etc.) rather than pixel statistics.

### JSZip in browser → server-side fflate

**What tried:** Browser built training ZIP using JSZip before sending to proxy.
**Why replaced:** JSZip on the main thread blocked the UI for several seconds for large image sets. Double base64 encoding (image → base64 → zip → base64) added unnecessary overhead and made payload sizes unreliable.
**Replaced with:** Browser sends raw `images: [{base64, filename}]` array. Proxy builds ZIP with `fflate` (zero-dependency, Bun-native). No main thread blocking.

### Multiresolution training disabled

**What:** `fal-ai/flux-lora-portrait-trainer` offers `multiresolution_training: true` which trains at multiple image scales.
**Why disabled:** Portrait LoRA doesn't benefit significantly from multiresolution — faces are always the primary subject regardless of scale. The feature adds 25–30% training time without measurable improvement in face identity at inference time.

### LoRA rank reduced from 16 → 8

**Why:** Rank 8 = half the trainable parameters. For portrait identity (a relatively constrained domain with low intrinsic dimensionality), rank 8 captures the necessary face-specific features without the extra parameters that add training time but learn noise. The ~20-30% training time reduction is worth the marginal quality tradeoff.

---

*This document reflects the system as of 2026-05-12. Update the decision log and known weaknesses sections whenever significant changes are made to the generation pipeline.*
