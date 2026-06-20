import type { AngleKey } from "../../data/athletes";

// ── Fixed test prompt suite — v1 ──────────────────────────────────────────────
// LOCKED: do not change without re-validating every athlete's canonical set.
// Version this alongside ACTIVE_HOUSE_STYLE — they're a coupled pair.
export const CANONICAL_TEST_PROMPTS_V1 = [
  "studio portrait, neutral expression, eyes to camera",
  "athletic posture, medium shot, looking off-camera",
  "three-quarter view, slight smile, environmental background",
  "close-up portrait, focused expression, shoulders visible",
  "profile angle, intense expression, training context",
  "head and shoulders, neutral background, soft directional light",
  "action posture, mid-movement, dynamic framing",
  "seated portrait, contemplative, environmental",
] as const;

export const TEST_PROMPT_SUITE_VERSION = "v1";

// ── Frame index → AngleKey mapping ───────────────────────────────────────────
// Frame numbers align with the 9-frame standardized capture protocol.
export const FRAME_TO_KEY: Record<number, AngleKey> = {
  1: "frame-1",  // face front, neutral, soft light (identity anchor — always in canonical set)
  2: "frame-2",  // face front, neutral, directional 45°
  3: "frame-3",  // face 3/4 left
  4: "frame-4",  // face 3/4 right
  5: "frame-5",  // face close-up, eye-level, soft
  6: "frame-6",  // face front, slight expression
  7: "frame-7",  // head + shoulders, medium
  8: "frame-8",  // 3/4 body front
  9: "frame-9",  // 3/4 body side
};

// ── Canonical combo definitions ───────────────────────────────────────────────
// 10 curated reference combinations tested in canonical set selection.
// frame-1 is always included as the identity anchor (hard rule).
// Combinations systematically vary which additional angles are included.
// Total cost per athlete: 10 combos × 8 prompts = 80 Nano Banana generations (~$4).
export interface CanonicalCombo {
  id: string;
  frames: number[];   // frame indices (1–9), frame 1 always first
  rationale: string;
}

export const CANONICAL_COMBOS: CanonicalCombo[] = [
  { id: "A", frames: [1, 2, 5, 7], rationale: "Front soft + front directional + close + medium — pure face coverage" },
  { id: "B", frames: [1, 3, 4, 5], rationale: "Front + left + right + close — angle variety, no directional" },
  { id: "C", frames: [1, 2, 3, 4], rationale: "Front soft + directional + both 3/4 angles — wide angle range" },
  { id: "D", frames: [1, 5, 6, 7], rationale: "Front + close + expression + medium — expression and scale range" },
  { id: "E", frames: [1, 2, 5, 6], rationale: "Front soft + directional + close + expression — lighting vs expression" },
  { id: "F", frames: [1, 3, 5, 7], rationale: "Front + 3/4 left + close + medium — left-biased angle range" },
  { id: "G", frames: [1, 4, 5, 7], rationale: "Front + 3/4 right + close + medium — right-biased angle range" },
  { id: "H", frames: [1, 2, 7, 8], rationale: "Front soft + directional + medium + body — does body context help?" },
  { id: "I", frames: [1, 5, 7, 8], rationale: "Front + close + medium + body — scale range including body" },
  { id: "J", frames: [1, 3, 4, 7], rationale: "Front + both 3/4 + medium — wider angle variety, no close" },
];

// ── Score threshold ───────────────────────────────────────────────────────────
// Mean embedding cosine similarity (0–1) below which canonical set is flagged as failed.
// Calibrate from real data; start at 0.50 and adjust.
export const CANONICAL_SCORE_THRESHOLD = 0.50;

// ── Helper — resolve frames to angle keys ─────────────────────────────────────
export function comboFrameKeys(combo: CanonicalCombo): AngleKey[] {
  return combo.frames.map(n => FRAME_TO_KEY[n]).filter(Boolean);
}
