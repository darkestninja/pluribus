import type { Athlete } from "../../data/athletes";

const SPORT_ACTIONS: Record<string, string[]> = {
  Swimming: [
    "explosive freestyle sprint at peak stroke",
    "powerful butterfly pull through water",
    "streamlined race-start dive, full extension",
    "race-finish touch, arms outstretched",
  ],
  Track: [
    "explosive sprint start off blocks, maximum drive",
    "peak-velocity mid-race stride, full extension",
    "finish-line lean, determination in every fibre",
    "relay baton exchange, pure athletic precision",
  ],
  Weightlifting: [
    "clean and jerk at peak overhead lock-out, full extension",
    "powerful snatch at peak overhead, bar aligned",
    "competition deadlift, raw strength, focus",
    "victory platform pose, arms raised in triumph",
  ],
};

const LOOK_MODIFIERS: Record<string, string> = {
  "B&W": "black and white, monochrome, high-contrast silver gelatin film aesthetic",
  Chrome: "vibrant chromatic colour, punchy saturation, film-like tones",
  Colour: "rich editorial colour grade, warm golden highlights, deep rich shadows",
  Matte: "matte desaturated film tones, soft contrast, cinematic grade",
  Vivid: "hyper-vivid saturated colour, electric tones, commercial sports grade",
};

const QUALITY_TAIL =
  "professional sports photography, razor-sharp focus, extreme detail in skin texture and muscle definition, shot on Phase One IQ4 150MP, no watermark, no text overlay";

export function buildAthleteDescriptor(a: Athlete): string {
  const parts: string[] = [`elite ${a.sport.toLowerCase()} athlete`];
  if (a.build) parts.push(a.build.toLowerCase());
  if (a.skinTone) parts.push(`${a.skinTone.toLowerCase()} complexion`);
  if (a.hair) parts.push(`${a.hair.toLowerCase()} hair`);
  if (a.age) parts.push(`approximately ${a.age} years old`);
  if (a.country) parts.push(`representing ${a.country}`);
  return parts.join(", ");
}

export interface EnhanceOptions {
  basePrompt: string;
  athlete?: Athlete | null;
  look?: string;
  /** already-built descriptor — skips buildAthleteDescriptor */
  athleteDescriptor?: string;
  /** do-not-change constraints from AthleteProfile — injected as negative direction */
  doNotChange?: string[];
  /** per-campaign creative brief — injected after identity constraints */
  brief?: string;
}

export function enhancePrompt(opts: EnhanceOptions): string {
  const { basePrompt, athlete, look, doNotChange, brief } = opts;
  const parts: string[] = [basePrompt.trim()];

  // Subject injection
  if (athlete) {
    const descriptor =
      opts.athleteDescriptor ?? buildAthleteDescriptor(athlete);
    parts.push(`Subject: ${athlete.name}, ${descriptor}`);

    const actions = SPORT_ACTIONS[athlete.sport];
    if (actions) {
      const action = actions[Math.floor(Math.random() * actions.length)];
      parts.push(`Action: ${action}`);
    }
  }

  // Look modifiers
  if (look && LOOK_MODIFIERS[look]) {
    parts.push(LOOK_MODIFIERS[look]);
  }

  // Identity constraints
  if (doNotChange && doNotChange.length > 0) {
    parts.push(`Identity constraints: ${doNotChange.join("; ")}`);
  }

  // Campaign creative brief
  if (brief && brief.trim()) {
    parts.push(`Campaign brief: ${brief.trim()}`);
  }

  parts.push(QUALITY_TAIL);

  return parts.join(". ");
}

/** Quick one-shot enhancer that builds prompt from workflow + athlete + identity constraints */
export function buildCampaignPrompt(
  workflowPrompt: string,
  athlete: Athlete,
  doNotChange?: string[],
  brief?: string,
): string {
  return enhancePrompt({
    basePrompt: workflowPrompt,
    athlete,
    doNotChange,
    brief,
  });
}
