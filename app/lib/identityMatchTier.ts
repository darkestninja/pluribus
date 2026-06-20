// ── Types ─────────────────────────────────────────────────────────────────────

export type IdentityMatchTierKey =
  | "hero_ready"
  | "campaign_ready"
  | "internal_review"
  | "exploration"
  | "weak";

export interface IdentityMatchTier {
  key: IdentityMatchTierKey;
  /** Short display label */
  label: string;
  /** One-line guidance for reviewers */
  recommendedUse: string;
  /** Why this tier restricts export (empty string when no restriction) */
  restrictionReason: string;
  severity: "success" | "info" | "warning" | "error";
  /** Score < threshold triggers auto-flag to "flagged" status */
  shouldAutoFlag: boolean;
  /** Only tiers with this true may appear in export zips */
  canApproveForExport: boolean;
  /** Auto-tag to apply when scoring completes (null = none) */
  autoTag: string | null;
  /** Tailwind classes for chip/badge use */
  bgClass: string;
  textClass: string;
  borderClass: string;
  /** Compact overlay style for thumbnails */
  overlayClass: string;
}

// ── Tier definitions ──────────────────────────────────────────────────────────

const TIERS: Record<IdentityMatchTierKey, IdentityMatchTier> = {
  hero_ready: {
    key:                "hero_ready",
    label:              "Hero ready",
    recommendedUse:     "OOH, hero placements, and key visuals",
    restrictionReason:  "",
    severity:           "success",
    shouldAutoFlag:     false,
    canApproveForExport: true,
    autoTag:            "hero_ready",
    bgClass:            "bg-emerald-500/15",
    textClass:          "text-emerald-400",
    borderClass:        "border-emerald-500/25",
    overlayClass:       "bg-emerald-500/80 text-white",
  },
  campaign_ready: {
    key:                "campaign_ready",
    label:              "Campaign ready",
    recommendedUse:     "Standard campaign placements",
    restrictionReason:  "",
    severity:           "info",
    shouldAutoFlag:     false,
    canApproveForExport: true,
    autoTag:            null,
    bgClass:            "bg-blue-500/15",
    textClass:          "text-blue-400",
    borderClass:        "border-blue-500/25",
    overlayClass:       "bg-blue-500/80 text-white",
  },
  internal_review: {
    key:                "internal_review",
    label:              "Internal review",
    recommendedUse:     "Internal review only",
    restrictionReason:  "Score 80–87 — not cleared for client delivery. Needs manual sign-off.",
    severity:           "warning",
    shouldAutoFlag:     false,
    canApproveForExport: false,
    autoTag:            "internal-review",
    bgClass:            "bg-amber-500/15",
    textClass:          "text-amber-400",
    borderClass:        "border-amber-500/25",
    overlayClass:       "bg-amber-500/80 text-white",
  },
  exploration: {
    key:                "exploration",
    label:              "Exploration",
    recommendedUse:     "Concept exploration and moodboards only",
    restrictionReason:  "Score 70–79 — identity fidelity too low for production use.",
    severity:           "warning",
    shouldAutoFlag:     false,
    canApproveForExport: false,
    autoTag:            "exploration",
    bgClass:            "bg-orange-500/15",
    textClass:          "text-orange-400",
    borderClass:        "border-orange-500/25",
    overlayClass:       "bg-orange-500/80 text-white",
  },
  weak: {
    key:                "weak",
    label:              "Weak identity",
    recommendedUse:     "Not cleared for any use",
    restrictionReason:  "Score below 70 — identity not preserved. Auto-flagged.",
    severity:           "error",
    shouldAutoFlag:     true,
    canApproveForExport: false,
    autoTag:            null,
    bgClass:            "bg-red-500/15",
    textClass:          "text-red-400",
    borderClass:        "border-red-500/25",
    overlayClass:       "bg-red-500/80 text-white",
  },
};

// ── Core lookup ───────────────────────────────────────────────────────────────

export function getIdentityMatchTier(score: number): IdentityMatchTier {
  if (score >= 92) return TIERS.hero_ready;
  if (score >= 88) return TIERS.campaign_ready;
  if (score >= 80) return TIERS.internal_review;
  if (score >= 70) return TIERS.exploration;
  return TIERS.weak;
}
