export interface Recipe {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  useCase: string;

  // Prompt
  prompt: string;
  negativePrompt: string;

  // Generation defaults
  aspectRatio: string;
  aspectRatioLocked: boolean;
  defaultLook?: string;

  // Creative direction
  styleRules: string[];
  lightingRules: string[];
  compositionRules: string[];

  // Visual language tokens (Creative Constitution §14)
  mood?: string;
  cameraStyle?: string;
  toneStyle?: string;

  // Review
  qualityChecklist: string[];

  // Metadata
  tags: string[];
  isSystemRecipe: boolean;
  createdAt: string;
  updatedAt: string;
}

const BASE_NEGATIVE =
  "ugly, distorted, blurry, low quality, artifacts, amateur photography, oversaturated, fake, plastic, uncanny, obvious AI, morphed features, extra fingers, wrong hands, anatomy error, text overlay, watermark, logo, multiple people";

export const seedRecipes: Recipe[] = [
  {
    id: "wf-noir-studio",
    name: "Classic Noir",
    description: "Studio B&W portrait · Rembrandt lighting · cinematic contrast",
    thumbnail: "/workflows/wf-1.jpg",
    useCase: "Editorial Portrait",
    prompt: `Studio portrait photography, 2×2 grid layout of four distinct poses, black and white, cinematic noir aesthetic. Rembrandt lighting — single hard key light at 45° elevated, deep shadow on one side, pronounced cheekbone catch-light. Background: seamless dark charcoal studio paper, gradient from near-black at top to dark grey at base. Camera: medium format, 85mm equivalent, f/2.8, sharp focus on eyes, subtle foreground bokeh on lower frame. Subject: elite Olympic athlete, powerful athletic build, composed expression. Wardrobe: clean white athletic compression top, no logos, no text. Each of the four frames shows a unique pose from the approved set. Tight 3/4 head-and-torso crop. Zero colour. Zero grain. Extreme detail in skin texture, muscle definition, fabric. Shot on Phase One IQ4 150MP. No vignette. No overlays.`,
    negativePrompt: `${BASE_NEGATIVE}, colour tones, warm tones, sepia, chromatic aberration, HDR glow, neon, random particles, coloured lighting, colour cast, colour grading`,
    aspectRatio: "1:1",
    aspectRatioLocked: true,
    defaultLook: "B&W",
    styleRules: [
      "Black and white only — no colour tones",
      "Strong shadow-to-light contrast (Rembrandt pattern)",
      "Studio controlled environment, no outdoor elements",
    ],
    lightingRules: [
      "Single hard key light at 45° elevated",
      "No fill light — deep shadow on one side",
      "Pronounced catch-light in eyes",
    ],
    compositionRules: [
      "Tight 3/4 head-and-torso crop",
      "Subject centred with controlled negative space",
    ],
    qualityChecklist: [
      "Face is sharp — eyes in critical focus",
      "Lighting creates Rembrandt shadow triangle on cheek",
      "Background is clean dark studio gradient",
      "Image is black and white — no colour tones present",
      "Skin texture and muscle definition clearly visible",
      "No text, watermark, or overlay",
    ],
    tags: ["Portrait", "Editorial", "B&W", "Studio"],
    isSystemRecipe: true,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },

  {
    id: "wf-daylight-action",
    name: "Daylight Action",
    description: "Outdoor action · golden hour · high contrast colour",
    thumbnail: "/workflows/wf-2.jpg",
    useCase: "Campaign Content",
    prompt: `Dynamic outdoor sports photography, athlete in peak action moment, golden hour lighting from low angle creating dramatic rim light and long shadows. Background: blurred stadium or outdoor track, warm amber tones, atmospheric haze. Camera: telephoto 200mm equivalent, f/2.8, fast shutter speed 1/2000s, frozen motion — zero motion blur. Subject: elite Olympic athlete, explosive power movement, peak physical exertion, determined expression. Wardrobe: competition gear, team colours. Wide crop showing full body in motion, low camera angle. Vibrant colour, high contrast, punchy deep shadows, warm highlights. Film-like chromatic quality. Shot on Canon EOS R3. Authentic sports photography.`,
    negativePrompt: `${BASE_NEGATIVE}, static pose, studio background, flat lighting, motion blur on subject, indoors, dark scene, night, grey sky, dull colours`,
    aspectRatio: "16:9",
    aspectRatioLocked: false,
    defaultLook: "Chrome",
    styleRules: [
      "High contrast punchy colour — vibrant, not oversaturated",
      "Outdoor sports energy — authentic athletic moment",
      "Film-like chromatic quality, warm golden tones",
    ],
    lightingRules: [
      "Golden hour — low angle sun from behind/side",
      "Dramatic rim light separating subject from background",
      "Long shadows for cinematic depth",
    ],
    compositionRules: [
      "Full body visible and in motion",
      "Low camera angle for power and scale",
      "Background blurred — subject sharp",
    ],
    qualityChecklist: [
      "Athlete is in peak action moment — not static",
      "Golden hour rim lighting is visible on subject",
      "Background is blurred stadium or outdoor track",
      "Subject is sharp — zero motion blur on athlete",
      "High contrast colour grade — warm highlights, deep shadows",
      "Competition gear with team colours visible",
    ],
    tags: ["Action", "Outdoor", "Colour", "Sport"],
    isSystemRecipe: true,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },

  {
    id: "wf-victory-podium",
    name: "Victory Podium",
    description: "Olympic celebration · stadium arena · editorial colour",
    thumbnail: "/workflows/wf-3.jpg",
    useCase: "Event Coverage",
    prompt: `Olympic victory celebration photography, athlete on podium or in arena at moment of triumph, dramatic stadium overhead lighting with warm key light cutting through arena atmosphere. Background: blurred crowd and stadium lights creating beautiful bokeh orbs, national flags, scoreboard glow. Camera: 85mm portrait lens, f/2.0, shallow depth of field isolating athlete from background. Subject: elite Olympic athlete, genuine emotion of victory — medal raised, arms wide open, authentic triumph expression. Wardrobe: competition gear with visible national emblems. 3/4 body or half-body crop, dynamic composition. Rich editorial colour grade — warm golden highlights, deep rich shadows, lifted blacks. Cinematic magazine-quality. Shot on Sony A1.`,
    negativePrompt: `${BASE_NEGATIVE}, sad, defeated, neutral expression, studio background, empty venue, no crowd, daylight outdoor, casual clothing`,
    aspectRatio: "4:5",
    aspectRatioLocked: false,
    defaultLook: "Colour",
    styleRules: [
      "Rich editorial colour grade — warm golden highlights, deep shadows",
      "Cinematic magazine quality",
      "Authentic emotion — not staged or forced",
    ],
    lightingRules: [
      "Dramatic stadium overhead lighting",
      "Warm key light cutting through arena atmosphere",
      "Stadium bokeh orbs in background",
    ],
    compositionRules: [
      "3/4 body or half-body crop",
      "Shallow depth of field isolating athlete",
      "Dynamic composition — not symmetric",
    ],
    qualityChecklist: [
      "Genuine victory emotion visible — not neutral",
      "Stadium or crowd visible in background",
      "Subject isolated from background with shallow DoF",
      "Rich warm colour grade applied",
      "National emblems or competition gear visible",
      "No studio elements present",
    ],
    tags: ["Victory", "Event", "Portrait", "Colour"],
    isSystemRecipe: true,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },

  {
    id: "recipe-editorial-portrait",
    name: "Editorial Portrait",
    description: "Clean editorial headshot · neutral · press-ready",
    thumbnail: "/workflows/wf-4.jpg",
    useCase: "Press Kit Image",
    prompt: `Editorial portrait photography of elite athlete, clean professional studio environment, neutral or confident expression looking directly at camera, soft controlled studio lighting with subtle fill, seamless light grey or off-white background. Camera: 85mm prime lens, f/4.0, sharp focus on face, slight background softness. Wardrobe: professional athletic wear or formal outfit, clean and intentional. Head and shoulders crop with balanced negative space. Premium editorial quality — subtle retouching, true-to-life skin tones. Magazine quality. Shot on Phase One IQ4.`,
    negativePrompt: `${BASE_NEGATIVE}, action pose, motion, dramatic shadows, dark background, coloured lighting, smiling excessively, casual clothing, sunglasses, hats, accessories, outdoor, stadium, crowd`,
    aspectRatio: "3:4",
    aspectRatioLocked: false,
    defaultLook: "Colour",
    styleRules: [
      "Premium restraint — clean and controlled",
      "True-to-life skin tones, subtle retouching",
      "Professional and editorial — not consumer",
    ],
    lightingRules: [
      "Soft studio key light with subtle fill",
      "Flattering for face structure",
      "No dramatic shadows or hard contrast",
    ],
    compositionRules: [
      "Head and shoulders crop",
      "Balanced negative space — not tight",
      "Subject centred or slight off-centre",
    ],
    qualityChecklist: [
      "Expression is neutral, confident, or professional",
      "Background is clean — no distracting elements",
      "Lighting is flattering and even",
      "Skin tones are accurate — not over-processed",
      "Head and shoulders clearly visible",
      "Press-ready framing — safe zones respected",
    ],
    tags: ["Portrait", "Editorial", "Press Kit", "Headshot"],
    isSystemRecipe: true,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },

  {
    id: "recipe-social-vertical",
    name: "Social Vertical",
    description: "9:16 vertical · social media · high engagement",
    thumbnail: "/workflows/wf-5.jpg",
    useCase: "Social Teaser",
    prompt: `Vertical format social media sports photography, 9:16 aspect ratio optimised for Instagram Stories and TikTok, elite athlete as primary subject, eye-catching dynamic composition, bold and immediate visual impact. Subject positioned in upper two-thirds of frame. Energetic or aspirational mood — athlete's personality and power evident. Strong silhouette and clear subject hierarchy. Background serves the athlete — not distracting. Vibrant or high-contrast colour treatment. No text or overlay. Premium social content quality.`,
    negativePrompt: `${BASE_NEGATIVE}, landscape orientation, horizontal crop, text overlay, caption, subtitle, social media frame, letterbox, boring pose, flat composition, equal top and bottom space`,
    aspectRatio: "9:16",
    aspectRatioLocked: true,
    defaultLook: "Chrome",
    styleRules: [
      "Vertical 9:16 — optimised for mobile screens",
      "Bold, immediate visual impact — thumb-stopping",
      "Vibrant or high-contrast — premium social quality",
    ],
    lightingRules: [
      "Strong and directional — creates visual energy",
      "Natural or dramatic — not flat studio",
    ],
    compositionRules: [
      "Subject in upper two-thirds of frame",
      "Strong vertical lines or dynamic angles",
      "No wasted space at top or bottom",
    ],
    qualityChecklist: [
      "Composition is vertical 9:16 — not cropped landscape",
      "Athlete's face visible in upper 2/3 of frame",
      "Mood is engaging and energetic",
      "No text, watermark, or social frame",
      "Would stop a user scrolling — high visual impact",
      "Background is not distracting from subject",
    ],
    tags: ["Social", "Vertical", "Instagram", "Action"],
    isSystemRecipe: true,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },

  {
    id: "recipe-announcement",
    name: "Athlete Announcement",
    description: "Signing day · partnership · broadcast-ready announcement",
    thumbnail: "/workflows/wf-6.jpg",
    useCase: "Athlete Announcement",
    prompt: `Professional athlete announcement photography, powerful composed portrait suitable for signing day, contract announcement, or partnership reveal. Subject standing tall, confident and composed, direct camera gaze communicating authority and readiness. Clean premium background — solid dark or architectural. Broadcast-quality lighting — strong key with controlled fill. Wardrobe: professional athletic or formal attire, sponsor-appropriate. Head-to-waist or full body crop. Premium commercial quality — this image will run in media outlets, press releases, and broadcast packages. Shot on Phase One IQ4.`,
    negativePrompt: `${BASE_NEGATIVE}, action pose, motion, sweat, dirty clothing, casual wear, messy background, cluttered environment, laughing, overly casual expression, sports jersey without sponsor approval`,
    aspectRatio: "4:5",
    aspectRatioLocked: false,
    defaultLook: "Colour",
    styleRules: [
      "Premium commercial quality — broadcast ready",
      "Confident, composed, authoritative mood",
      "Sponsor and brand safe — clean and professional",
    ],
    lightingRules: [
      "Strong key with controlled fill — professional broadcast look",
      "Clean separation from background",
      "No unflattering shadows on face",
    ],
    compositionRules: [
      "Head-to-waist or full-body",
      "Subject slightly off-centre or centred — intentional",
      "Clean background with strong subject separation",
    ],
    qualityChecklist: [
      "Expression is confident and composed — not casual",
      "Wardrobe is professional and sponsor-appropriate",
      "Background is clean — no distracting elements",
      "Lighting is broadcast quality — strong and controlled",
      "Suitable for use in press releases and media",
      "No elements that could conflict with sponsorship",
    ],
    tags: ["Announcement", "Commercial", "Broadcast", "Portrait"],
    isSystemRecipe: true,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
];
