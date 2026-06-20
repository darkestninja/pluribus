export type AngleKey =
  // ── v3 protocol — 9 frames: 5 angles × passport + body, plus face close-up ──
  | "front-passport"  // front, head & shoulders, neutral expression
  | "front-body"      // front, full body, neutral stance
  | "left-passport"   // left profile, head & shoulders
  | "left-body"       // left profile, full body
  | "right-passport"  // right profile, head & shoulders
  | "right-body"      // right profile, full body
  | "back-passport"   // rear, head & shoulders
  | "back-body"       // rear, full body
  | "face-close"      // tight face close-up, eye-level
  // ── Legacy keys — kept for backward-compat with stored profiles ─────────────
  | "face-front" | "face-left" | "face-right" | "face-back"
  | "body-front" | "body-left" | "body-right" | "body-back"
  | "frame-1" | "frame-2" | "frame-3" | "frame-4" | "frame-5"
  | "frame-6" | "frame-7" | "frame-8" | "frame-9";

export interface CaptureAngle {
  key: AngleKey;
  /** base64 data URL — local fallback only. Cleared once storagePath is set. */
  dataUrl?: string;
  uploadedAt: string;
  notes?: string;
  /** Supabase Storage signed URL — preferred for display */
  storageUrl?: string;
  /** Storage object path — authoritative durable reference; allows signed-URL refresh */
  storagePath?: string;
  /** fal CDN permanent URL — cached after first upload; used by generation to skip re-upload */
  falCdnUrl?: string;
}

export interface TattooMark {
  id: string;
  description: string;
  location: string;
  visible: boolean;
  imageUrl?: string;              // compressed photo of the tattoo
  bodyX?: number;                 // 0–100, percentage x on body map
  bodyY?: number;                 // 0–100, percentage y on body map
  bodyView?: "front" | "back";   // which body side was pinned
}

export interface ApprovedLikeness {
  imageUrl: string;      // fal.ai CDN URL
  context: string;       // e.g. "Front face, daylight, competition gear"
  approvedAt: string;
}

export interface RejectedLikeness {
  imageUrl: string;
  context: string;       // e.g. "Wrong hair colour, bad angle"
  rejectedAt: string;
  reason?: string;       // optional free-text reason
}

export interface AthleteProfile {
  athleteId: string;
  version: number;
  updatedAt: string;
  captureAngles: CaptureAngle[];
  tattoos: TattooMark[];
  doNotChange: string[];
  approvedLikeness: ApprovedLikeness[];
  rejectedLikeness?: RejectedLikeness[];
  notes: string;
  /** fal CDN URL of trained LoRA weights — set after training completes */
  loraUrl?: string;
  /** Job status for LoRA training */
  loraStatus?: "training" | "ready" | "failed";
  /** fal queue request ID while training is in progress */
  loraJobId?: string;
  loraTrainedAt?: string;
  /** Trigger phrase used during training — prepended to generation prompts */
  loraTriggerPhrase?: string;
  // ── Canonical reference set (v2 pipeline) ─────────────────────────────────
  /** The 4 frame keys (frame-1 through frame-9) locked as this athlete's canonical reference set */
  canonicalReferenceFrameIds?: string[];
  /** Mean face embedding cosine similarity (0–1) of the winning combo across test prompts */
  canonicalSetScore?: number;
  /** Score variance across test prompts — lower = more consistent identity */
  canonicalSetVariance?: number;
  canonicalSetValidatedAt?: string;
  /** House style version this canonical set was validated against */
  canonicalSetHouseStyleVersion?: string;
  /** 8 test output URLs from the winning combo — the athlete's identity card */
  canonicalSetIdentityCardUrls?: string[];
  canonicalSetStatus?: "pending" | "validating" | "ready" | "failed";
  canonicalSetFailureReason?: string;
  /** Proxy job ID for polling canonical validation progress */
  canonicalJobId?: string;
  /** Subject portal invite token — set when an invite link is generated */
  portalToken?: string;
  portalInvitedAt?: string;
  portalInvitedBy?: string;
  /** Usage consent submitted by the subject via SubjectPortal */
  usageConsent?: UsageConsent;
  /** Collaboration task list for this subject */
  collabTasks?: CollabTask[];
}

// ── Collaboration / consent types ────────────────────────────────────────────

export type UsageScope =
  | "social_media"
  | "paid_advertising"
  | "out_of_home"
  | "press_editorial"
  | "internal_only"
  | "unlimited";

export interface UsageConsent {
  consentGiven: boolean;
  consentAt?: string;
  scopes: UsageScope[];
  note?: string;
  expiresAt?: string;
}

export interface CollabTask {
  id: string;
  subjectId: string;
  type: "upload_references" | "review_outputs" | "sign_consent" | "custom";
  title: string;
  description?: string;
  status: "pending" | "complete" | "blocked";
  createdAt: string;
  completedAt?: string;
  dueBy?: string;
}

export interface Athlete {
  id: string;
  name: string;
  sport: string;
  event: string;
  status: "complete" | "pending" | "review";
  image: string;
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

export const athletes: Athlete[] = [];
