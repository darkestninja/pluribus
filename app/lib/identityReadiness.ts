import type { AthleteProfile, CaptureAngle } from "../../data/athletes";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReadinessStatus = "incomplete" | "usable" | "campaign_ready" | "unstable";

export interface IdentityReadinessResult {
  /** 0–100 composite score */
  score: number;
  status: ReadinessStatus;
  /** Hard blockers — required before the profile is usable */
  missingRequirements: string[];
  /** Soft issues — won't block but may degrade output quality */
  warnings: string[];
  /** Single most impactful action the user can take right now */
  recommendedNextAction: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasImage(a: CaptureAngle | undefined): boolean {
  return !!(a?.dataUrl || a?.falCdnUrl || a?.storageUrl);
}

function hasDurable(a: CaptureAngle | undefined): boolean {
  return !!(a?.storagePath || a?.falCdnUrl);
}

// Priority face angles — ordered by identity-signal strength
const FACE_PRIORITY = ["face-close", "front-passport", "left-passport", "right-passport"] as const;
const FACE_WEIGHTS  = { "face-close": 16, "front-passport": 14, "left-passport": 7, "right-passport": 7 };

// Body angles
const BODY_KEYS = ["front-body", "back-passport", "back-body", "left-body", "right-body"] as const;
const BODY_WEIGHTS = { "front-body": 6, "back-passport": 1, "back-body": 1, "left-body": 1, "right-body": 1 };

// Canonical variance threshold above which consistency is considered unreliable
const HIGH_VARIANCE_THRESHOLD = 0.15;
// Rejected-likeness count at which the profile is flagged unstable
const UNSTABLE_REJECTION_COUNT = 3;

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Computes an identity readiness score and status for an athlete profile.
 * Fully deterministic — no I/O. Safe to call on every render.
 *
 * Score breakdown (100 pts):
 *   Face captures      44 pts  (face-close 16, front-passport 14, left 7, right 7)
 *   Body captures      10 pts  (front-body 6, back-passport 1, others 1 each)
 *   Storage durability  6 pts  (1.5 per priority face capture stored/CDN)
 *   Canonical set      20 pts  (score-gated; 0 if not validated)
 *   Approved likeness  14 pts  (1→5, 2→9, 3+→14)
 *   doNotChange         6 pts  (any constraint present)
 */
export function calculateIdentityReadiness(
  profile: AthleteProfile | null,
): IdentityReadinessResult {
  if (!profile || profile.captureAngles.length === 0) {
    return {
      score: 0,
      status: "incomplete",
      missingRequirements: [
        "Face close-up photo",
        "Front portrait photo",
        "Left-side portrait photo",
        "Right-side portrait photo",
        "Front full-body photo",
      ],
      warnings: [],
      recommendedNextAction: "Upload a face close-up photo to get started",
    };
  }

  const angleMap = new Map(profile.captureAngles.map(a => [a.key, a]));
  const get      = (key: string) => angleMap.get(key as never);

  // ── 1. Face captures (44 pts) ────────────────────────────────────────────────
  let faceScore = 0;
  for (const key of FACE_PRIORITY) {
    if (hasImage(get(key))) faceScore += FACE_WEIGHTS[key];
  }

  // ── 2. Body captures (10 pts) ────────────────────────────────────────────────
  let bodyScore = 0;
  for (const key of BODY_KEYS) {
    if (hasImage(get(key))) bodyScore += BODY_WEIGHTS[key];
  }

  // ── 3. Storage durability (6 pts, 1.5 per priority face angle) ───────────────
  let storageScore = 0;
  for (const key of FACE_PRIORITY) {
    if (hasImage(get(key)) && hasDurable(get(key))) storageScore += 1.5;
  }

  // ── 4. Canonical set (20 pts) ────────────────────────────────────────────────
  let canonicalScore = 0;
  const cs     = profile.canonicalSetStatus;
  const csVal  = profile.canonicalSetScore;
  if (cs === "ready" && csVal !== undefined) {
    if      (csVal >= 0.85) canonicalScore = 20;
    else if (csVal >= 0.75) canonicalScore = 16;
    else if (csVal >= 0.65) canonicalScore = 12;
    else                    canonicalScore = 6;
  }

  // ── 5. Approved likeness (14 pts) ────────────────────────────────────────────
  const approvedCount = profile.approvedLikeness.length;
  const likenessScore = approvedCount >= 3 ? 14 : approvedCount === 2 ? 9 : approvedCount === 1 ? 5 : 0;

  // ── 6. doNotChange constraints (6 pts) ───────────────────────────────────────
  const constraintScore = profile.doNotChange.length > 0 ? 6 : 0;

  const score = Math.min(
    Math.round(faceScore + bodyScore + storageScore + canonicalScore + likenessScore + constraintScore),
    100,
  );

  // ── Missing requirements ──────────────────────────────────────────────────────
  const missingRequirements: string[] = [];
  if (!hasImage(get("face-close")))     missingRequirements.push("Face close-up photo");
  if (!hasImage(get("front-passport"))) missingRequirements.push("Front portrait photo");
  if (!hasImage(get("left-passport")))  missingRequirements.push("Left-side portrait photo");
  if (!hasImage(get("right-passport"))) missingRequirements.push("Right-side portrait photo");
  if (!hasImage(get("front-body")))     missingRequirements.push("Front full-body photo");

  // ── Warnings ──────────────────────────────────────────────────────────────────
  const warnings: string[] = [];

  const rejectedCount = profile.rejectedLikeness?.length ?? 0;
  const variance      = profile.canonicalSetVariance;

  if (rejectedCount >= UNSTABLE_REJECTION_COUNT) {
    warnings.push(`${rejectedCount} rejected likenesses — generation consistency may be degraded`);
  }
  if (cs === "ready" && variance !== undefined && variance > HIGH_VARIANCE_THRESHOLD) {
    warnings.push(`High identity variance (${Math.round(variance * 100)}%) — consistent output not guaranteed`);
  }
  if (cs === "failed") {
    warnings.push(profile.canonicalSetFailureReason
      ? `Identity check failed: ${profile.canonicalSetFailureReason}`
      : "Identity check failed — re-upload captures and retry");
  }

  const localOnlyCount = FACE_PRIORITY.filter(k => {
    const a = get(k);
    return hasImage(a) && !hasDurable(a);
  }).length;
  if (localOnlyCount > 0) {
    warnings.push(
      `${localOnlyCount} reference photo${localOnlyCount > 1 ? "s" : ""} stored locally only — upload to cloud to persist across devices`,
    );
  }

  if (cs !== "ready" && cs !== "validating" && profile.captureAngles.filter(a => hasImage(a)).length >= 3) {
    warnings.push("Identity check not yet run — face consistency unverified");
  }
  if (approvedCount === 0 && missingRequirements.length === 0) {
    warnings.push("No approved likenesses — approve generated outputs to improve model guidance");
  }

  // ── Status ────────────────────────────────────────────────────────────────────
  const isUnstable =
    rejectedCount >= UNSTABLE_REJECTION_COUNT ||
    (cs === "ready" && variance !== undefined && variance > HIGH_VARIANCE_THRESHOLD);

  const status: ReadinessStatus = isUnstable
    ? "unstable"
    : score >= 88 ? "campaign_ready"
    : score >= 50 ? "usable"
    : "incomplete";

  // ── Recommended next action ───────────────────────────────────────────────────
  let recommendedNextAction: string;
  if (missingRequirements.length > 0) {
    recommendedNextAction = `Upload: ${missingRequirements[0].toLowerCase()}`;
  } else if (cs === "failed") {
    recommendedNextAction = "Re-upload captures and retry the identity check";
  } else if (cs !== "ready" && cs !== "validating") {
    recommendedNextAction = "Run the identity check to verify face consistency";
  } else if (isUnstable && rejectedCount >= UNSTABLE_REJECTION_COUNT) {
    recommendedNextAction = "Remove low-quality rejected likenesses and re-run identity check";
  } else if (isUnstable) {
    recommendedNextAction = "Re-upload captures with better lighting and re-run identity check";
  } else if (approvedCount < 3) {
    recommendedNextAction = `Approve ${3 - approvedCount} more generated image${3 - approvedCount > 1 ? "s" : ""} as approved likenesses`;
  } else if (profile.doNotChange.length === 0) {
    recommendedNextAction = "Add at least one 'do not change' constraint to preserve distinctive features";
  } else {
    recommendedNextAction = "Profile is campaign-ready — no further action needed";
  }

  return { score, status, missingRequirements, warnings, recommendedNextAction };
}

// ── UI helpers ────────────────────────────────────────────────────────────────

export const READINESS_CONFIG: Record<ReadinessStatus, { label: string; color: string; bgClass: string; textClass: string; borderClass: string }> = {
  incomplete:     { label: "Incomplete",      color: "#71717a", bgClass: "bg-zinc-500/15",    textClass: "text-zinc-400",    borderClass: "border-zinc-500/25"    },
  usable:         { label: "Usable",          color: "#f59e0b", bgClass: "bg-amber-500/15",   textClass: "text-amber-400",   borderClass: "border-amber-500/25"   },
  campaign_ready: { label: "Campaign ready",  color: "#10b981", bgClass: "bg-emerald-500/15", textClass: "text-emerald-400", borderClass: "border-emerald-500/25" },
  unstable:       { label: "Unstable",        color: "#f97316", bgClass: "bg-orange-500/15",  textClass: "text-orange-400",  borderClass: "border-orange-500/25"  },
};
