export interface Workflow {
  id: string;
  name: string;
  thumbnail: string;
  description?: string;
  aspectRatio?: string;
  defaultLook?: string;
  tags?: string[];
  prompt?: string;
}

export const workflowTemplates: Workflow[] = [
  {
    id: "wf-noir-studio",
    name: "Classic Noir",
    thumbnail: "/workflows/wf-1.jpg",
    description: "Studio B&W portrait · Rembrandt lighting · cinematic contrast",
    aspectRatio: "1:1",
    defaultLook: "B&W",
    tags: ["Portrait", "Editorial", "B&W"],
    prompt: `Studio portrait photography, 2×2 grid layout of four distinct poses, black and white, cinematic noir aesthetic. Rembrandt lighting — single hard key light at 45° elevated, deep shadow on one side, pronounced cheekbone catch-light. Background: seamless dark charcoal studio paper, gradient from near-black at top to dark grey at base. Camera: medium format, 85mm equivalent, f/2.8, sharp focus on eyes, subtle foreground bokeh on lower frame. Subject: elite Olympic athlete, powerful athletic build, composed expression. Wardrobe: clean white athletic compression top, no logos, no text. Each of the four frames shows a unique pose from the approved set. Tight 3/4 head-and-torso crop. Zero colour. Zero grain. Extreme detail in skin texture, muscle definition, fabric. Shot on Phase One IQ4 150MP. No vignette. No overlays.`,
  },
  {
    id: "wf-daylight-action",
    name: "Daylight Action",
    thumbnail: "/workflows/wf-2.jpg",
    description: "Outdoor action · golden hour · high contrast colour",
    aspectRatio: "16:9",
    defaultLook: "Chrome",
    tags: ["Action", "Outdoor", "Colour"],
    prompt: `Dynamic outdoor sports photography, athlete in peak action moment, golden hour lighting from low angle creating dramatic rim light and long shadows. Background: blurred stadium or outdoor track, warm amber tones, atmospheric haze. Camera: telephoto 200mm equivalent, f/2.8, fast shutter speed 1/2000s, frozen motion — zero motion blur. Subject: elite Olympic athlete, explosive power movement, peak physical exertion, determined expression. Wardrobe: competition gear, team colours. Wide crop showing full body in motion, low camera angle. Vibrant colour, high contrast, punchy deep shadows, warm highlights. Film-like chromatic quality. Shot on Canon EOS R3. Authentic sports photography.`,
  },
  {
    id: "wf-victory-podium",
    name: "Victory Podium",
    thumbnail: "/workflows/wf-3.jpg",
    description: "Olympic celebration · stadium arena · editorial colour",
    aspectRatio: "4:5",
    defaultLook: "Colour",
    tags: ["Victory", "Event", "Portrait"],
    prompt: `Olympic victory celebration photography, athlete on podium or in arena at moment of triumph, dramatic stadium overhead lighting with warm key light cutting through arena atmosphere. Background: blurred crowd and stadium lights creating beautiful bokeh orbs, national flags, scoreboard glow. Camera: 85mm portrait lens, f/2.0, shallow depth of field isolating athlete from background. Subject: elite Olympic athlete, genuine emotion of victory — medal raised, arms wide open, authentic triumph expression. Wardrobe: competition gear with visible national emblems. 3/4 body or half-body crop, dynamic composition. Rich editorial colour grade — warm golden highlights, deep rich shadows, lifted blacks. Cinematic magazine-quality. Shot on Sony A1.`,
  },
];
