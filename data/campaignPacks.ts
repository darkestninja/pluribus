export interface PackSlot {
  label: string;
  aspectRatio: string;
  count: number;
  /** Base prompt fragment appended to subject name and constraints */
  promptNotes: string;
  intendedUse: string;
}

export interface CampaignPack {
  id: string;
  name: string;
  description: string;
  slots: PackSlot[];
}

/** Credits per generated image — matches IMAGE_TIERS[0].credits in Workspace */
export const PACK_CREDITS_PER_IMAGE = 4;

export function packTotalImages(pack: CampaignPack): number {
  return pack.slots.reduce((n, s) => n + s.count, 0);
}

export function packTotalCredits(pack: CampaignPack): number {
  return packTotalImages(pack) * PACK_CREDITS_PER_IMAGE;
}

export const CAMPAIGN_PACKS: CampaignPack[] = [
  {
    id: "athlete-announcement",
    name: "Athlete Announcement",
    description: "Launch assets for a new signing or partnership announcement",
    slots: [
      {
        label:       "Hero portrait",
        aspectRatio: "4:5",
        count:       2,
        promptNotes: "clean hero portrait, professional athlete, strong presence, neutral background, sharp focus",
        intendedUse: "Campaign hero / OOH",
      },
      {
        label:       "Social vertical",
        aspectRatio: "9:16",
        count:       2,
        promptNotes: "dynamic sports action, bold vertical composition, high energy",
        intendedUse: "Instagram Stories / Reels",
      },
      {
        label:       "Profile image",
        aspectRatio: "1:1",
        count:       1,
        promptNotes: "clean profile shot, bright background, confident expression, square crop",
        intendedUse: "Avatar / social profile",
      },
    ],
  },
  {
    id: "hero-campaign",
    name: "Hero Campaign",
    description: "Full production set for a flagship campaign",
    slots: [
      {
        label:       "Hero commercial",
        aspectRatio: "4:5",
        count:       3,
        promptNotes: "high-end commercial photography, dramatic lighting, powerful athletic pose",
        intendedUse: "Campaign hero / paid media",
      },
      {
        label:       "Editorial landscape",
        aspectRatio: "16:9",
        count:       2,
        promptNotes: "dramatic editorial, wide cinematic format, moody atmosphere",
        intendedUse: "Editorial / press",
      },
      {
        label:       "Social vertical",
        aspectRatio: "9:16",
        count:       2,
        promptNotes: "vibrant social content, bold colours, action energy, story format",
        intendedUse: "Social media",
      },
    ],
  },
  {
    id: "social-content",
    name: "Social Content",
    description: "High-volume social-first assets for content calendars",
    slots: [
      {
        label:       "Story / Reel",
        aspectRatio: "9:16",
        count:       4,
        promptNotes: "dynamic sports action, story-format vertical, high energy, bold crop",
        intendedUse: "Instagram Stories / Reels",
      },
      {
        label:       "Square post",
        aspectRatio: "1:1",
        count:       2,
        promptNotes: "engaging portrait, clean composition, social-friendly framing",
        intendedUse: "Feed post",
      },
    ],
  },
  {
    id: "sponsor-clean",
    name: "Sponsor Clean",
    description: "Studio-clean sponsor deliverables with minimal backgrounds",
    slots: [
      {
        label:       "Studio hero portrait",
        aspectRatio: "4:5",
        count:       2,
        promptNotes: "clean white or light grey studio background, branded kit, sharp identity, high fidelity, no distractions",
        intendedUse: "Sponsor asset / product placement",
      },
      {
        label:       "Studio landscape",
        aspectRatio: "16:9",
        count:       2,
        promptNotes: "white or light grey studio, branded kit, horizontal format, sponsor-safe clean background",
        intendedUse: "Sponsor asset / website banner",
      },
    ],
  },
];
