# Pluribus — Technical Reference

> Last updated: 2026-05-16  
> URL: https://pluribus.danielasiegbunam.com

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Architecture](#2-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Dependencies](#4-dependencies)
5. [Environment Variables](#5-environment-variables)
6. [Data Models](#6-data-models)
7. [Store API](#7-store-api)
8. [Generation Pipeline](#8-generation-pipeline)
9. [Identity Matching & Confirmation](#9-identity-matching--confirmation)
10. [Prompt System](#10-prompt-system)
11. [Wardrobe & Moodboard](#11-wardrobe--moodboard)
12. [Storage & Assets](#12-storage--assets)
13. [Authentication & Auth Flow](#13-authentication--auth-flow)
14. [Proxy Server Endpoints](#14-proxy-server-endpoints)
15. [Supabase Schema](#15-supabase-schema)
16. [Component Map](#16-component-map)
17. [Key User Flows](#17-key-user-flows)
18. [External Services](#18-external-services)
19. [Deployment](#19-deployment)
20. [Known Issues & Gaps](#20-known-issues--gaps)

---

## 1. Product Overview

Pluribus is an AI-native creative infrastructure platform for athletes, sports brands, and media teams. It generates identity-preserving images and videos of athletes using structured recipes, wardrobe references, and moodboard direction — then routes outputs through an approval workflow before campaign delivery.

**Core capabilities:**

- Identity-locked image generation (athlete face preserved across all outputs)
- Structured generation recipes (camera, lighting, background, styling, motion, output)
- Wardrobe as image reference (not text prompt) — garment photos passed directly to the model
- Moodboard creative direction — mood, lighting, colour palette extracted from inspiration images
- Non-blocking background generation — navigate away, results auto-saved
- Multi-state approval workflow (pending → approved → delivered)
- Supabase Storage asset mirroring — permanent archive independent of fal CDN
- External shareable review links (token-based, no login required)
- Campaign ZIP export

---

## 2. Architecture

```
Browser (Vite SPA)
    │
    ├── Supabase Auth (JWT)
    ├── fal.ai client (via proxy)
    │
    └── nginx (TLS, rate-limit, CSP)
            │
            ├── /api/fal/* → Bun proxy (127.0.0.1:3333)
            │       ├── fal.ai API (generation, CDN upload, webhooks)
            │       ├── Supabase (auth admin, storage mirror)
            │       ├── Anthropic Claude (face compare, analysis)
            │       └── Resend (transactional email)
            │
            └── / → Vite SPA (dist/)
```

**Runtime processes:**

| Process | Location | Port |
|---------|----------|------|
| Vite SPA (nginx static) | /var/www/pluribus | 443 (nginx) |
| Bun proxy | /opt/pluribus-proxy | 3333 (localhost) |
| Supabase | Managed cloud | — |

**Data persistence layers (in priority order):**

1. In-memory `_cache` object (fastest, lost on page unload)
2. `localStorage` under `plb_{userId}_{key}` namespace
3. Supabase Postgres (write-through on every mutation, 3× backoff)
4. Supabase Storage (asset mirroring, signed URLs)

---

## 3. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 18.3.1 |
| Build Tool | Vite | 6.3.5 |
| Language | TypeScript | Latest |
| Styling | Tailwind CSS v4 | 4.1.12 |
| Component Library | Radix UI | Various |
| State | React useState / custom store | — |
| Backend / DB | Supabase (Postgres + Auth + Storage) | ^2.105.3 |
| Image Generation | fal.ai (Nano Banana Pro / Gemini 3) | ^1.10.0 |
| Video Generation | fal.ai (Pika, Kling, Sora) | ^1.10.0 |
| Vision Analysis | Anthropic Claude Haiku | API |
| Email | Resend | API |
| Proxy Runtime | Bun | Latest |
| Reverse Proxy | nginx | System |
| TLS | Let's Encrypt | — |

---

## 4. Dependencies

### Frontend (`/opt/pluribus/package.json`)

**AI & Generation**
- `@fal-ai/client ^1.10.0` — fal.ai SDK (image, video, queue, CDN upload)
- `@supabase/supabase-js ^2.105.3` — Supabase client (auth, DB, storage)

**UI**
- `@mui/material 7.3.5`, `@mui/icons-material 7.3.5` — Material UI components
- `@emotion/react 11.14.0`, `@emotion/styled 11.14.1` — MUI peer deps
- 26× Radix UI primitives — accordion, dialog, dropdown, hover-card, label, popover, progress, radio-group, scroll-area, select, separator, slider, slot, switch, tabs, toggle, tooltip
- `cmdk 1.1.1` — command palette
- `sonner 2.0.3` — toast notifications
- `vaul 1.1.2` — bottom drawer
- `motion 12.23.24` — animation
- `next-themes 0.4.6` — dark/light mode

**Data & Layout**
- `recharts 2.15.2` — analytics charts
- `react-resizable-panels 2.1.7` — split-pane layouts
- `embla-carousel-react 8.6.0` — carousel
- `react-responsive-masonry 2.7.1` — masonry grid
- `react-dnd 16.0.1` + `react-dnd-html5-backend 16.0.1` — drag and drop
- `react-hook-form 7.55.0` — form management
- `jszip ^3.10.1` — campaign ZIP export
- `date-fns 3.6.0` — date formatting
- `canvas-confetti 1.9.4` — celebration animation
- `tailwind-merge 3.2.0`, `clsx 2.1.1` — class utilities

**Dev**
- `vite 6.3.5`, `@vitejs/plugin-react 4.7.0`
- `@tailwindcss/vite 4.1.12`
- `@types/jszip ^3.4.1`

### Proxy (`/opt/pluribus-proxy/package.json`)

- `@supabase/supabase-js ^2.105.3` — admin operations (service role)
- `fflate ^0.8.2` — ZIP compression for exports

### Bundle Optimisation

Vite `manualChunks` splits into:

| Chunk | Contents |
|-------|----------|
| `vendor-react` | react, react-dom |
| `vendor-ui` | motion, cmdk, sonner |
| `vendor-radix` | All Radix primitives |
| `vendor-supabase` | @supabase/supabase-js |
| `vendor-fal` | @fal-ai/client |

Nine heavy page components are lazy-loaded via `React.lazy` + `Suspense`.

---

## 5. Environment Variables

### Frontend (Vite, prefix `VITE_`)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key |

### Proxy (Bun)

| Variable | Purpose | Default |
|----------|---------|---------|
| `FAL_KEY` | fal.ai secret key | Required |
| `SUPABASE_URL` | Supabase project URL | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (admin) | Required |
| `ANTHROPIC_API_KEY` | Claude API key | Required |
| `RESEND_API_KEY` | Resend email API key | Required |
| `APP_ORIGIN` | Frontend origin for CORS | `http://185.158.132.125` |
| `FROM_EMAIL` | Sender address for transactional email | `onboarding@resend.dev` |
| `COMFYUI_URL` | ComfyUI server URL (unused) | — |

---

## 6. Data Models

### Athlete

```typescript
interface Athlete {
  id: string;
  name: string;
  sport: string;
  event: string;
  status: "complete" | "pending" | "review";
  image: string;           // avatar URL
  captureDate: string | null;
  height?: string;
  weight?: string;
  build?: string;
  skinTone?: string;
  hair?: string;
  age?: number;
  country?: string;
  personalBest?: string;
}
```

### AthleteProfile (identity data)

```typescript
interface AthleteProfile {
  athleteId: string;
  version: number;
  updatedAt: string;
  captureAngles: CaptureAngle[];      // 9-frame v3 semantic protocol
  tattoos: TattooMark[];              // { location, description, visible }
  doNotChange: string[];              // constraints e.g. "visible neck tattoo"
  approvedLikeness: ApprovedLikeness[];
  rejectedLikeness?: RejectedLikeness[];
  notes: string;
  loraUrl?: string;                   // trained LoRA weights on fal CDN
  loraStatus?: "training" | "ready" | "failed";
  loraTriggerPhrase?: string;
  // Canonical reference set (v3)
  canonicalReferenceFrameIds?: string[];     // 4 selected frame keys
  canonicalSetScore?: number;                // 0–1 cosine similarity avg
  canonicalSetVariance?: number;
  canonicalSetValidatedAt?: string;
  canonicalSetStatus?: "pending" | "validating" | "ready" | "failed";
  canonicalSetIdentityCardUrls?: string[];   // 8 test generation outputs
}
```

### CaptureAngle

```typescript
interface CaptureAngle {
  key: AngleKey;
  dataUrl: string;          // base64 (local fallback)
  uploadedAt: string;
  notes?: string;
  storageUrl?: string;      // Supabase signed URL (preferred for display)
  storagePath?: string;     // path for URL refresh
  falCdnUrl?: string;       // fal CDN permanent URL (reused across generations)
}
```

**AngleKey — v3 semantic protocol (9 frames):**

| Key | Description |
|-----|-------------|
| `face-close` | Extreme close-up face, highest identity weight |
| `front-passport` | Front passport-style face |
| `left-passport` | 45° left passport |
| `right-passport` | 45° right passport |
| `back-passport` | Back of head |
| `front-body` | Full body, facing front |
| `left-body` | Full body, facing left |
| `right-body` | Full body, facing right |
| `back-body` | Full body, back view |

Reference selection order for generation: `face-close` → passport angles → body angles.

### WardrobeKit

```typescript
interface WardrobeKit {
  id: string;
  name: string;
  mode: "builder" | "upload";   // builder = colour picker; upload = image ref
  sport: SportCategory;
  items: ClothingItem[];         // builder mode items
  logo?: WardrobeLogo;
  uploadDataUrls?: string[];     // upload mode — multiple photos (preferred)
  uploadDataUrl?: string;        // legacy single photo (backward compat)
  uploadDescription?: string;    // AI-analysed one-sentence garment description
  createdAt: string;
  updatedAt: string;
}
```

**Upload-mode wardrobe kits pass photos as image references directly to the model — not as text in the prompt.** Builder-mode kits (colour/item picker) use text.

### Moodboard

```typescript
interface Moodboard {
  id: string;
  name: string;
  sources: MoodboardSource[];    // { id, thumbnail (base64 ≤512px), filename?, sourceUrl? }
  direction: CreativeDirection | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface CreativeDirection {
  mood: string;           // e.g. "bold, energetic, triumphant"
  colorPalette: string;   // e.g. "deep navy, electric gold, matte black"
  lighting: string;       // e.g. "dramatic rim lighting, side key"
  composition: string;    // e.g. "low angle, full body, rule of thirds"
  style: string;          // e.g. "cinematic editorial, hyper-real"
  environment: string;    // e.g. "urban street at night"
  summary: string;        // 2–3 sentence brief
}
```

### CampaignRecipe

Structured generation recipe with full creative control. Key sections:

```typescript
interface CampaignRecipe {
  id: string;
  name: string;
  description: string;
  category: "portrait" | "motion" | "editorial" | "social" | "product" | "documentary";
  isStarter: boolean;
  
  camera: {
    shotType: "close_up" | "medium" | "three_quarter" | "full_body";
    lens: "35mm" | "50mm" | "85mm" | "100mm";
    angle: string;
    crop: "tight" | "standard" | "wide";
  };
  
  lighting: {
    setup: "soft_studio" | "hard_key" | "high_contrast" | "natural_light" | "arena_spotlight" | "night_flash";
    direction: "front" | "side_left" | "side_right" | "back_rim" | "overhead";
    contrast: "low" | "medium" | "high" | "very_high";
  };
  
  background: {
    type: "plain_gradient" | "black" | "white" | "concrete" | "track" | "gym" | "arena" | "tunnel" | "night_exterior" | "product_set";
    detailLevel: string;
  };
  
  styling: {
    wardrobe: string;         // text override (if no wardrobe kit selected)
    colorPalette: string;
    skinRetouching: string;   // removed from prompt output (identity conflict)
  };
  
  subject: {
    expression: string;
    pose: string;
    energy: "calm" | "focused" | "intense" | "celebratory";
  };
  
  motion: {
    enabled: boolean;
    type: "none" | "subtle" | "action" | "extreme";
    intensity: "low" | "medium" | "high";
    faceSharp: boolean;
  };
  
  output: {
    aspectRatio: string;
    setType: string;
    quality: "draft" | "standard" | "premium";
  };
  
  randomization: {
    enabled: boolean;
    strength: "low" | "medium" | "high";
    fields: {
      cameraAngle: boolean;
      crop: boolean;
      lightingDirection: boolean;
      background: boolean;
      pose: boolean;
      expression: boolean;
      motionIntensity: boolean;
      aspectRatio: boolean;
    };
  };
  
  createdAt: string;
  updatedAt: string;
}
```

15 starter recipes are pre-configured: Premium Sports Campaign, Clean Studio Portrait, Gritty Training, Motion Sprint, Hero Commercial, etc.

### Project (Campaign)

```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  thumbnail: string;
  lastEdited: string;
  type: "active" | "archived";
  athleteName?: string;
  athleteIds?: string[];
  recipeId?: string;
  status?: "draft" | "in_review" | "approved" | "delivered";
  assetCount?: number;
  brief?: string;
  moodboardImages?: string[];
  exportLog?: ExportLogEntry[];
}
```

### GenerationJob

```typescript
interface GenerationJob {
  id: string;
  subjectId?: string;
  subjectName?: string;
  recipeId?: string;
  recipeName?: string;
  prompt: string;
  aspectRatio: string;
  modelId: string;
  requestId: string;          // fal queue request ID
  status: "queued" | "running" | "complete" | "failed";
  progress: number;           // 0–100
  resultUrls: string[];
  error?: string;
  seed?: number;
  startedAt: string;
  completedAt?: string;
  runId?: string;
  campaignId?: string;
  mode: "image" | "video";
}
```

### Run

```typescript
interface Run {
  id: string;
  campaignId: string;
  athleteId?: string;
  athleteName?: string;
  recipeId?: string;
  recipeName?: string;
  recipeSnapshot?: Record<string, unknown>;  // immutable copy at generation time
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  model: string;
  aspectRatio: string;
  status: "running" | "complete" | "failed";
  startedAt: string;
  completedAt?: string;
  assetIds: string[];
  errorMessage?: string;
}
```

### CampaignOutput

```typescript
interface CampaignOutput {
  id: string;
  campaignId: string;
  athleteId?: string;
  runId?: string;
  url: string;                // Supabase signed URL (preferred) or fal CDN fallback
  storagePath?: string;       // Supabase Storage path
  originalFalUrl?: string;    // original fal CDN URL (temporary, may expire)
  status: "pending" | "approved" | "needs_revision" | "rejected" | "flagged";
  resemblanceScore?: number;  // 0–100 Claude vision identity score
  createdAt: string;
  comments?: OutputComment[];
  reviewedBy?: string;
  reviewedAt?: string;
  tags?: string[];
  reviewHistory?: ReviewHistoryEntry[];
  rejectionReason?: "FACE_DRIFT" | "AGE_DRIFT" | "SKIN_TONE" | "TATTOO_MISMATCH" | "WARDROBE" | "CONTEXT" | "QUALITY";
}
```

---

## 7. Store API

All data operations go through `/opt/pluribus/app/lib/store.ts`. The store is:
- Initialised per user on login via `initStore(userId, email)`
- Hydrated from Supabase on first load via `hydrateStore(userId)`
- In-memory cache → localStorage → Supabase (write-through, 3× exponential backoff)
- Namespace-isolated: `plb_{userId}_{key}`

### Athlete Functions

| Function | Returns | Notes |
|----------|---------|-------|
| `getAthletes()` | `Athlete[]` | From cache |
| `getAthleteProfile(athleteId)` | `AthleteProfile \| null` | |
| `saveAthleteProfile(profile)` | `Promise<void>` | Write-through |
| `getProfileCompleteness(athleteId)` | `number` | 0–100 pct |
| `getCanonicalReferences(profile)` | `string[]` | Ordered by face priority (falCdnUrl → storageUrl → dataUrl) |

### Campaign Functions

| Function | Returns |
|----------|---------|
| `getProjects(archived?)` | `Project[]` |
| `addProject(p)` | `void` |
| `updateProject(id, partial)` | `void` |
| `getCampaignOutputs()` | `CampaignOutput[]` |
| `addCampaignOutput(o)` | `void` |
| `updateCampaignOutput(id, patch)` | `void` |

### Run Functions

| Function | Returns |
|----------|---------|
| `addRun(r)` | `void` |
| `getRuns(campaignId)` | `Run[]` |
| `updateRun(campaignId, runId, patch)` | `void` |

### Generation Job Functions

| Function | Returns |
|----------|---------|
| `getJobs()` | `GenerationJob[]` |
| `addJob(j)` | `void` |
| `updateJob(id, patch)` | `void` |
| `getJobById(id)` | `GenerationJob \| null` |
| `getActiveJobForCampaign(campaignId)` | `GenerationJob \| null` |

### Recipe Functions

| Function | Returns |
|----------|---------|
| `getRecipes()` | `Recipe[]` |
| `getCampaignRecipes()` | `CampaignRecipe[]` |
| `getCampaignRecipeById(id)` | `CampaignRecipe \| null` |
| `getWardrobeKits()` | `WardrobeKit[]` |
| `addWardrobeKit(kit)` | `void` |
| `updateWardrobeKit(id, patch)` | `void` |
| `getMoodboards()` | `Moodboard[]` |
| `addMoodboard(mb)` | `void` |
| `updateMoodboard(id, patch)` | `void` |

### Credits

| Function | Returns |
|----------|---------|
| `getCredits()` | `number` |
| `deductCredits(n)` | `number` (remaining) |
| `refreshCredits()` | `Promise<void>` |

---

## 8. Generation Pipeline

### Image Generation — Primary Flow

```
User clicks "Generate image"
    │
    ├── getCanonicalReferences(profile)
    │       Returns up to 4 face URLs ordered:
    │       face-close → front-passport → left/right-passport → body angles
    │       (falCdnUrl preferred over storageUrl over dataUrl)
    │
    ├── getWardrobeRefImages(wardrobeKit)
    │       Upload-mode kits: uploadDataUrls[] or uploadDataUrl
    │       Builder-mode kits: [] (text prompt handles it)
    │
    ├── submitGeneration({ prompt, aspectRatio, referenceImageDataUrls, wardrobeImageUrls })
    │       │
    │       ├── ensureCdnUrl() each face ref (skip if already https://)
    │       ├── ensureCdnUrl() each wardrobe ref (upload if data URL)
    │       ├── buildRefPrompt(faceCount, wardrobeCount) → identity/wardrobe instructions
    │       ├── fal.queue.submit(modelId, { input, webhookUrl })
    │       └── Returns { requestId, modelId }
    │
    ├── addJob({ ...job, status: "queued" }) → localStorage
    │
    └── Global poller (App.tsx, 1.5s interval)
            │
            ├── pollGenerationStatus(modelId, requestId)
            │       ├── Check /api/fal/job-result (webhook cache — instant if fal POSTed)
            │       └── Fallback: fal.queue.status()
            │
            ├── Time-based progress: Math.min(85, 5 + (elapsed/35) * 80)
            │
            ├── On COMPLETED:
            │       ├── fetchGenerationResult() → image URLs
            │       ├── updateJob({ status: "complete", resultUrls, completedAt })
            │       ├── addCampaignOutput({ url, campaignId, athleteId })
            │       ├── mirrorAsset(falUrl, storagePath) → Supabase Storage (non-blocking)
            │       └── toast("Generation ready")
            │
            └── Workspace (1s local sync) reads job state → updates UI
```

### Model Selection

| Condition | Model |
|-----------|-------|
| No reference images | `fal-ai/nano-banana-pro` |
| Face refs or wardrobe refs present | `fal-ai/nano-banana-pro/edit` |

Both are Gemini 3 Pro based on fal.ai.

### Video Generation

```
submitGeneration (video path)
    │
    └── generateVideo({ prompt, model, duration, aspectRatio })
            │
            ├── fal.subscribe(modelId, { input: { prompt, duration, aspect_ratio } })
            └── Returns GeneratedVideo { url }
```

**Video models:**

| ID | fal endpoint |
|----|-------------|
| `pika` | `fal-ai/pika-v2.2/text-to-video` |
| `kling` | `fal-ai/kling-video/v2/master/text-to-video` |
| `kling-pro` | `fal-ai/kling-video/v2/pro/text-to-video` |
| `sora` | `fal-ai/sora` |

### CDN Pre-warming

When an athlete is selected in the Studio, all uncached capture angles are silently uploaded to the fal CDN in the background:

```
selectedAthleteId changes
    → filter captureAngles where !falCdnUrl && dataUrl.startsWith("data:")
    → for each: uploadToFalCdn(dataUrl) → save falCdnUrl to profile
```

This means `ensureCdnUrl()` at generation time is a no-op (URL already starts with `https://`) — eliminating the upload wait from the critical path.

### Webhook Flow

fal.ai POSTs generation results to `/api/fal/webhook` on completion. The proxy caches the result in an in-memory `Map<requestId, WebhookResult>`. The next poll cycle checks `/api/fal/job-result?requestId=` first, returning `COMPLETED` instantly without a round-trip to fal.

---

## 9. Identity Matching & Confirmation

### How Identity Is Locked During Generation

Nano Banana Pro is Google Gemini 3 Pro hosted on fal.ai. It accepts visual context via `image_urls` — a list of reference images passed directly into the multimodal context window. This is distinct from traditional ControlNet or IP-Adapter; the model uses language-vision understanding to interpret "preserve this face."

**Reference image construction:**

```
image_urls = [
  face-close CDN URL,      ← highest priority
  front-passport CDN URL,
  left-passport CDN URL,
  right-passport CDN URL,  ← up to 4 face refs
  wardrobe photo 1,        ← up to 2 wardrobe refs (if upload-mode kit)
  wardrobe photo 2,
]
```

**Prompt prefix (face refs only):**
```
Preserve exact facial structure, eye shape, jawline, and skin texture from
the reference image. Realistic skin with visible pores and natural texture.
Same person as in the reference photos. Ignore any clothing visible in the
reference images — do not copy the reference outfit. Default wardrobe: plain
black t-shirt and black trousers, unless the prompt specifies different clothing.
```

**Prompt prefix (face + wardrobe refs):**
```
You have N identity reference image(s) (first in the list) and M wardrobe
reference image(s) (last in the list).

IDENTITY REFERENCES: Preserve exact facial structure, eye shape, jawline,
skin tone and texture. Same person must appear in the output. Ignore clothing
from identity reference images.

WARDROBE REFERENCES (HIGH PRIORITY): Dress the subject in exactly the outfit
shown in the wardrobe reference images — match garment type, colors, cut,
fabric, and styling precisely.

Realistic skin with visible pores and natural texture.
```

**Negative prompt (always applied with refs):**
```
different person, different face, changed identity, fat face, puffy cheeks,
bloated jaw, plastic skin, smooth skin, airbrushed, beauty filter,
different ethnicity, different hair colour, same clothing as reference,
copying reference outfit, same outfit as reference photos
[+ wrong outfit, different clothing style, naked, missing garment,
different garment colors — when wardrobe refs present]
```

**Aspect ratio:** passed as `aspect_ratio: "9:16"` directly (Gemini parameter convention — not the Flux `image_size` enum).

### How Identity Is Scored Post-Generation

After every completed generation, `computeResemblanceScore(referenceUrl, generatedUrl)` is called automatically.

**Flow:**

```
computeResemblanceScore(referenceUrl, generatedUrl)
    │
    └── POST /analyze/face-compare (proxy)
            │
            ├── Fetch reference image (base64 or URL)
            ├── Fetch generated image (URL)
            │
            └── Anthropic Claude Haiku vision call:
                    System: "You are a strict identity verification system.
                             Compare ONLY facial identity — ignore lighting,
                             pose, expression, camera angle, and styling."
                    
                    Prompt: Two images inline. Score on:
                    - Facial bone structure and proportions
                    - Eye shape, spacing, brow arch
                    - Nose shape and width
                    - Jawline and chin definition
                    - Cheekbone prominence
                    - Ear shape
                    - Skin tone
                    
                    Returns JSON:
                    {
                      score: 0–100,
                      confidence: "high" | "medium" | "low",
                      keyMatches: string[],
                      keyDifferences: string[]
                    }
```

**Score thresholds:**

| Score | Label | Badge colour |
|-------|-------|--------------|
| ≥ 80 | Excellent match | Green (accent) |
| 65–79 | Acceptable | Amber |
| < 65 | Weak / rejected | Red |

The score badge is shown on the generated image in the Studio and on every card in the Runs queue. Scores are persisted on `CampaignOutput.resemblanceScore`.

### Canonical Reference Set Validation

For production campaigns, a stricter 9-frame validation is available:

1. Select 4 reference frames as the "canonical set"
2. Run 3 generation test prompts via Nano Banana
3. Score all 3 outputs with Claude Haiku
4. Compute average identity score + variance
5. Store result on `AthleteProfile.canonicalSetScore`

The canonical set is considered "ready" if average score ≥ 80 and variance is low.

---

## 10. Prompt System

### Recipe Mode (CampaignRecipe)

`buildCampaignRecipePrompt(recipe, subjectName)` produces a ~400-word structured prompt:

```
SUBJECT: {name}. Use the provided identity reference images — this person
must appear in the output.

IDENTITY LOCK: Preserve exactly — face shape, eye shape and colour, jawline,
nose, lips, skin tone, skin texture, hair colour and style, tattoos, scars,
body proportions, and age. The same person must be immediately recognisable.
Never alter any identity characteristic.

CAMERA: {shot type}, {lens}, {angle}, {crop}
LIGHTING: {setup} — {direction} — contrast {level}
BACKGROUND: {type} — {detail}
STYLING: {wardrobe text}. Colours: {palette}. Preserve the subject's actual
  skin tone and texture exactly — do not smooth, retouch, or alter.
POSE & EXPRESSION: {pose}. {expression}. Energy: {energy}.
[MOTION: {type} at {intensity}. Face sharp: {yes/no}.]
OUTPUT: {aspect ratio}. {set type}. Quality: {quality}.

RULES:
- IDENTITY FIRST: The subject's identity is the highest priority.
- Photorealistic skin with visible pores, natural texture, subsurface scattering.
- Eyes sharp and in focus.
- No artefacts, compositing seams, or AI tells.
- Shot on Phase One IQ4 150MP.
```

**Negative prompt** (always applied with campaign recipes):
```
different person, different face, wrong athlete, wrong individual,
ai face, plastic skin, smooth skin, airbrushed, beauty filter,
different ethnicity, different hair colour, wrong skin tone,
changed skin tone, lightened skin, darkened skin...
```

**Randomization:** When `recipe.randomization.enabled`, `applyRecipeRandomization()` samples from defined pools before building the prompt — providing variation while maintaining creative intent.

### Legacy Recipe Mode

`buildNanaBananaPrompt(recipe, doNotChange?)` joins 7 structured fields:

```
{shot}, {action}, {environment}, {lighting}, {mood}, {style}, {colorStyle}
[, do not change: {doNotChange items}]
```

Max ~60 words, comma-separated. Falls back to `recipe.prompt` if no structured fields.

### Custom Prompt Mode

User types freeform. Optionally run through `enhancePrompt()` which removes instruction language ("must", "forbidden", "never", "avoid") that wastes tokens.

### Prompt Assembly Order

```
[1] Identity prefix (from generateImage/submitGeneration)
[2] Recipe prompt (CampaignRecipe | Legacy | Custom)
[3] Extra direction (customNotes appended with ", ")
[4] Wardrobe text (builder-mode kits only; upload kits use image refs)
[5] Moodboard direction (if selected)
```

---

## 11. Wardrobe & Moodboard

### Wardrobe

Two modes:

**Builder mode** — user picks sport, clothing items (jersey, shorts, shoes, etc.), colours from an 18-colour palette, and a logo placement. `buildWardrobePrompt()` formats items as:
```
Wardrobe: wearing {item list}. {Brand} logo on {placement}.
```

**Upload mode** — user uploads one or more garment photos. These are passed as `image_urls` in the fal request (after face refs) with the prompt instruction to match the outfit exactly. No text prompt is generated. Up to 2 wardrobe images are used.

Wardrobe kits are created and managed in the Wardrobe Library page or inline in the Studio (Browse / + New tabs in the picker).

### Moodboard

Users upload inspiration images. `analyzeMoodboardImages()` calls the proxy which passes thumbnails to Claude Haiku and extracts a structured `CreativeDirection` (mood, colorPalette, lighting, composition, style, environment, summary).

`buildMoodboardPrompt()` appends the direction as a 7-line block to the generation prompt.

Moodboards are created in the Moodboard Library or inline in the Studio picker.

---

## 12. Storage & Assets

### Supabase Storage Buckets

| Bucket | Contents |
|--------|----------|
| `pluribus-assets-private` | Generated outputs, reference captures, likeness proofs |
| `pluribus-exports-private` | Campaign ZIP exports |

Both buckets enforce RLS: `auth.uid() = substring(name, 1, 36)` — user ID must be the first path segment.

### Storage Paths

```typescript
generatedAssetPath(userId, campaignId, outputId)
  → "{userId}/campaigns/{campaignId}/generated/{outputId}.jpg"

referenceImagePath(userId, athleteId, angleKey)
  → "{userId}/subjects/{athleteId}/references/{angleKey}.jpg"

likenessPath(userId, athleteId, type, outputId)
  → "{userId}/subjects/{athleteId}/{type}_likeness/{outputId}.jpg"

exportZipPath(userId, campaignId, filename)
  → "{userId}/campaigns/{campaignId}/exports/{filename}"
```

### Asset URL Priority

Generated outputs have three possible URLs, used in priority order:
1. `CampaignOutput.url` — Supabase signed URL (365-day, permanent)
2. `CampaignOutput.originalFalUrl` — fal CDN URL (may expire after days/weeks)

### Mirror Flow

Every completed generation is mirrored to Supabase Storage non-blocking:

```
Generation complete
    → mirrorAsset(falUrl, storagePath) via POST /storage/mirror
        → Proxy downloads from fal CDN
        → Uploads to Supabase Storage
        → Returns { path, signedUrl }
    → updateCampaignOutput({ url: signedUrl, storagePath })
```

### Reference Image Capture

When an athlete's reference photo is captured/uploaded:
- Stored as base64 `dataUrl` on `CaptureAngle.dataUrl` (local fallback)
- Uploaded to Supabase Storage → `storageUrl` set
- Uploaded to fal CDN on first generation → `falCdnUrl` set (reused thereafter)

---

## 13. Authentication & Auth Flow

### Sign-up Flow

```
User submits signup form
    │
    └── POST /auth/signup (proxy)
            ├── Supabase admin.auth.createUser({ email, password, email_confirm: true })
            │       (auto-confirms email, skips verification)
            ├── Resend: send welcome email
            └── Returns { ok: true }

Browser: supabase.auth.signInWithPassword({ email, password })
    → JWT stored in localStorage
    → onAuthStateChange fires → initStore(userId, email) → hydrateStore(userId)
```

### Session Lifecycle

- JWT attached to all fal proxy requests via `requestMiddleware` in fal.config
- JWT attached to all proxy vision/storage requests as `Authorization: Bearer {token}`
- All Supabase RLS policies check `auth.uid() = user_id`
- Session auto-refreshed by Supabase client

### Role System

| Role | Access |
|------|--------|
| `admin` | All features including Identity Studio |
| `editor` | Generate, approve, export |
| `viewer` | View and comment only |

Role stored in Supabase user metadata. Checked via `getUserRole()` in store.

### Review Links

Campaign outputs can be shared without login via a 32-character token:
- `review_tokens` table maps `token → campaign_id`
- `/review/{token}` route renders `ReviewPage` — no auth wall
- Token expiry enforced (stored in `expires_at`)

---

## 14. Proxy Server Endpoints

Base: `http://127.0.0.1:3333` (nginx rewrites `/api/*` → `/`)

### Auth

#### `POST /auth/signup`
Creates user via Supabase admin API, sends welcome email.

```
Body:  { name: string, email: string, password: string }
Returns: { ok: boolean, error?: string }
```

### Vision Analysis (all require `Authorization: Bearer {token}`)

#### `POST /analyze/face-compare`
Compares two faces using Claude Haiku vision.

```
Body: {
  referenceBase64?: string,   // base64 image data
  referenceUrl?: string,      // HTTP URL (proxy fetches)
  referenceMime?: string,
  generatedUrl: string        // fal CDN or Supabase URL
}
Returns: {
  ok: boolean,
  score: number,              // 0–100
  confidence: "high" | "medium" | "low",
  keyMatches: string[],
  keyDifferences: string[]
}
```

#### `POST /analyze/subject`
Infers athlete attributes from a photo.

```
Body:    { imageBase64: string, mimeType: string }
Returns: { ok, build?, skinTone?, hair?, age?, sport? }
```

#### `POST /analyze/garment`
One-sentence garment description for upload-mode wardrobe.

```
Body:    { imageBase64: string, mimeType: string }
Returns: { ok, description: string }
```

#### `POST /analyze/moodboard`
Extracts CreativeDirection from up to 8 images.

```
Body:    { thumbnails: string[] }  // base64 dataUrls
Returns: { ok, direction: CreativeDirection }
```

### fal.ai Proxy

#### `POST /fal/proxy` (→ `/api/fal/proxy` via nginx)
Passes authenticated requests through to fal.ai. fal client auto-routes all requests here.

#### `POST /fal/upload` (→ `/api/fal/upload` via nginx)
Uploads base64 image to fal CDN.

```
Body:    { imageBase64: string, mimeType: string }
Returns: { ok: boolean, url?: string, error?: string }
```

#### `POST /fal/webhook` (→ `/api/fal/webhook` via nginx)
fal.ai POSTs generation results here on completion. **No auth required** (fal does not send tokens). Cached in memory by `requestId`.

#### `GET /fal/job-result?requestId=xxx`
Returns cached webhook result for a request ID.

```
Returns: { found: boolean, status?: string, images?: GeneratedImage[] }
```

### Storage

#### `POST /storage/mirror`
Downloads from fal CDN, uploads to Supabase Storage.

```
Body:    { falUrl: string, storagePath: string, bucket?: string }
Returns: { path: string, signedUrl: string }
```

### Canonical Validation

#### `POST /canonical/validate`
Initiates 9-frame reference set validation (generates test images, scores with Claude Haiku).

#### `GET /canonical/status/{jobId}`
Returns validation job status and partial results.

### Utilities

#### `POST /fetch/url`
Fetches images from a URL for moodboard import. Extracts OG images.

#### `POST /fetch/preview`
Returns OG metadata for link preview cards.

---

## 15. Supabase Schema

All tables enforce `RLS: (auth.uid() = user_id)`.

| Table | Key Columns | Notes |
|-------|------------|-------|
| `subjects` | id, user_id, name, sport, event, status, image_url | Athletes |
| `subject_profiles` | subject_id, user_id, capture_angles (JSONB), tattoos (JSONB), version | Identity data |
| `campaigns` | id, user_id, type, data (JSONB Project), updated_at | Projects |
| `campaign_outputs` | id, campaign_id, user_id, athlete_id, url, storage_path, status, resemblance_score, review_history (JSONB) | Generated assets |
| `campaign_runs` | id, campaign_id, user_id, athlete_id, prompt, model, status, asset_ids (JSONB) | Generation history |
| `recipes` | id, user_id, is_system, data (JSONB Recipe) | Legacy recipes |
| `campaign_recipes` | id, user_id, data (JSONB CampaignRecipe) | Structured recipes |
| `wardrobe_kits` | id, user_id, data (JSONB WardrobeKit) | Wardrobe |
| `moodboards` | id, user_id, data (JSONB Moodboard) | Moodboards |
| `review_tokens` | id, campaign_id, user_id, token, expires_at | Shareable links |

**Storage buckets:** `pluribus-assets-private`, `pluribus-exports-private`  
**RLS:** `auth.uid() = substring(name, 1, 36)`

---

## 16. Component Map

### Pages (lazy-loaded)

| Component | Route/View | Purpose |
|-----------|-----------|---------|
| `Dashboard` | home | Overview, quick actions |
| `Projects` | campaigns | Campaign list + management |
| `AthleteLibrary` | subjects | Athlete list, capture, profile |
| `Workspace` | studio | Generation studio |
| `CampaignRecipeLibrary` | recipes | Recipe browser + editor |
| `WardrobeLibrary` | wardrobe | Wardrobe kit builder |
| `MoodboardLibrary` | moodboards | Moodboard creator |
| `IdentityStudio` | identity (admin) | Canonical set validation |
| `LibraryPage` | library | Asset library, approval workflow |
| `QueuePage` | queue | Generation runs + history |
| `ArchivePage` | archive | Archived campaigns |
| `Settings` | settings | Account, billing |
| `ReviewPage` | /review/{token} | External review (no auth) |

### Modals & Panels

| Component | Purpose |
|-----------|---------|
| `CampaignWorkspace` | Per-campaign asset management |
| `CampaignGallery` | Asset grid within campaign |
| `CampaignSidebar` | Campaign brief / recipe overview |
| `AssetDetailPanel` | Full output detail, approval, comments |
| `ComparePanel` | Side-by-side identity comparison |
| `CommandPalette` | ⌘K global search + navigation |
| `NewCampaignModal` | Campaign creation form |
| `AddAthleteModal` | Athlete onboarding |
| `DebugPanel` | Admin-only debug overlay |
| `Onboarding` | First-run wizard |

---

## 17. Key User Flows

### New Generation (Studio)

1. Open Studio (via "New render" or from campaign)
2. Select subject → pre-warm triggers CDN upload for all capture angles
3. Select recipe or custom prompt
4. Optionally select wardrobe kit and/or moodboard
5. Adjust aspect ratio (Advanced panel)
6. Click **Generate image**
7. Job submitted to fal queue (`fal.queue.submit`)
8. Toast: "Generating in background" — user can navigate freely
9. Global poller (1.5s) checks webhook cache → updates progress
10. On complete: result appears in Studio, in Runs queue, auto-saved to CampaignOutput
11. Asset mirrored to Supabase Storage (non-blocking)
12. Identity score computed (Claude Haiku face compare)
13. Changing any setting → button switches to "Generate image" (not "Regenerate")
14. All generations in session shown in history strip at bottom

### Approval Flow

1. Asset created with status `pending`
2. Reviewer opens LibraryPage → asset grid
3. Options: Approve, Needs Revision, Reject (with reason), Flag
4. Comment thread attached to each output
5. Review history logged (who, when, action)
6. Approved assets eligible for campaign export

### External Review

1. Admin creates review link for a campaign
2. 32-char token stored in `review_tokens`
3. Link shared with external stakeholder (e.g. athlete's agent)
4. `/review/{token}` opens `ReviewPage` — no login required
5. Reviewer can approve/reject/comment
6. Actions write back to `campaign_outputs` via proxy (token validated server-side)

### Campaign Export

1. Select approved outputs in campaign
2. Click Export → campaign ZIP generated
3. ZIP includes: all approved images at original resolution, metadata JSON
4. ZIP uploaded to `pluribus-exports-private` bucket
5. Download link returned (signed URL, 1 hour)

---

## 18. External Services

| Service | Purpose | Key Env Var |
|---------|---------|------------|
| **fal.ai** | Image generation (`nano-banana-pro`, `nano-banana-pro/edit`), video generation (Pika, Kling, Sora), CDN upload, queue management, webhooks | `FAL_KEY` |
| **Supabase** | Auth (JWT, email), Postgres (all app data), Storage (asset archive) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_ANON_KEY` |
| **Anthropic Claude Haiku** | Face identity comparison, athlete attribute analysis, garment description, moodboard creative direction extraction | `ANTHROPIC_API_KEY` |
| **Resend** | Transactional email (welcome, password reset) | `RESEND_API_KEY` |

### fal.ai Models Used

| Model ID | Use |
|----------|-----|
| `fal-ai/nano-banana-pro` | Identity-preserving image gen (no refs) |
| `fal-ai/nano-banana-pro/edit` | Identity-preserving image gen (with refs) |
| `fal-ai/pika-v2.2/text-to-video` | Pika video generation |
| `fal-ai/kling-video/v2/master/text-to-video` | Kling standard video |
| `fal-ai/kling-video/v2/pro/text-to-video` | Kling pro video |
| `fal-ai/sora` | Sora cinematic video |

### Credit Costs

| Operation | Credits | Est. Cost |
|-----------|---------|-----------|
| Image generation | 4cr | ~$0.04 |
| Pika video | 25cr | ~$0.25 |
| Kling video | 35cr | ~$0.35 |
| Sora video | 150cr | ~$1.50 |

---

## 19. Deployment

### Infrastructure

| Component | Details |
|-----------|---------|
| Domain | `pluribus.danielasiegbunam.com` |
| TLS | Let's Encrypt via certbot |
| Reverse proxy | nginx — terminates TLS, rewrites `/api/*`, rate-limits at burst=30 |
| Frontend | Vite SPA at `/var/www/pluribus/` (static, nginx-served) |
| Proxy server | Bun at `127.0.0.1:3333`, systemd managed |
| Database | Supabase cloud (hosted Postgres) |
| Storage | Supabase Storage (S3-compatible) |

### Build & Deploy

```bash
# Build frontend
cd /opt/pluribus
npm run build

# Deploy (copy dist to nginx web root)
cp -r dist/* /var/www/pluribus/

# Proxy runs automatically (systemd service)
# No restart needed for proxy unless proxy.ts changes
```

### nginx Configuration

- `/api/fal/` → rewrites to `/fal/` on proxy at 127.0.0.1:3333
- `/api/` → proxy at 127.0.0.1:3333
- `/` → static SPA (try_files, fallback to index.html for SPA routing)
- Rate limit: burst=30 on fal proxy endpoints
- CSP headers set
- Gzip compression enabled

---

## 20. Known Issues & Gaps

| Issue | Severity | Notes |
|-------|----------|-------|
| `doNotChange` constraints not injected into generation prompts | Medium | Deliberate trade-off — NB prompt is already at token limit; tracked for future |
| `styleReferenceUrls` array is empty — house style inactive | Medium | Placeholder; fal CDN URLs needed |
| Base64 dataUrls stored in Supabase JSONB | Medium | ~9MB per subject profile; migration to storage paths in progress |
| fal CDN URLs are temporary | Medium | Mitigated by Supabase Storage mirror; `originalFalUrl` kept as fallback |
| `CampaignSidebar` crash on `wf.styleRules.length` | Potential blocker | `wf` (workflow) may be undefined |
| No pagination on campaign outputs or runs | Low | Acceptable at current scale |
| Identity score computation is best-effort | Low | Claude Haiku vision calls can return null on network failure |
| `ASPECT_TO_SIZE` mapping table unused | Trivial | Kept for future Flux model support |

---

*This document reflects the codebase state as of Sprint 18 (2026-05-16). For architectural decisions and rationale see `docs/decisions.md`. For current sprint status see `docs/tasks.md`.*
