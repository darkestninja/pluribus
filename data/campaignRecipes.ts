// ── Campaign Recipe type ────────────────────────────────────────────────────

export type CampaignRecipeCategory =
  | "portrait"
  | "motion"
  | "editorial"
  | "social"
  | "product"
  | "documentary";

export interface CampaignRecipe {
  id: string;
  name: string;
  description: string;
  category: CampaignRecipeCategory;
  isStarter: boolean;
  createdAt: string;
  updatedAt: string;

  camera: {
    shotType: "close_up" | "medium" | "three_quarter" | "full_body";
    lens: "35mm" | "50mm" | "85mm" | "100mm";
    angle: "eye_level" | "low_angle" | "slight_high_angle";
    crop: "tight" | "standard" | "wide";
  };

  lighting: {
    setup:
      | "soft_studio"
      | "hard_key"
      | "high_contrast"
      | "natural_light"
      | "arena_spotlight"
      | "night_flash";
    direction: "front" | "side_left" | "side_right" | "back_rim" | "overhead";
    contrast: "low" | "medium" | "high" | "very_high";
  };

  background: {
    type:
      | "plain_gradient"
      | "black"
      | "white"
      | "concrete"
      | "track"
      | "gym"
      | "arena"
      | "tunnel"
      | "night_exterior"
      | "product_set";
    detailLevel: "minimal" | "moderate" | "detailed";
  };

  styling: {
    wardrobe:
      | "performance_wear"
      | "training_wear"
      | "team_kit"
      | "luxury_sportswear"
      | "minimal_black"
      | "product_focused";
    colorPalette:
      | "neutral"
      | "black_white"
      | "warm"
      | "cool"
      | "brand_color_accent"
      | "high_saturation";
    skinRetouching: "natural" | "polished" | "raw";
  };

  subject: {
    expression: "neutral" | "focused" | "confident" | "intense" | "relaxed";
    pose:
      | "standing_power"
      | "ready_position"
      | "in_motion"
      | "seated"
      | "arms_crossed"
      | "hands_on_hips";
    energy: "calm" | "controlled" | "dynamic" | "explosive";
  };

  motion: {
    enabled: boolean;
    type: "none" | "frozen_action" | "motion_blur" | "motion_echo";
    intensity: "none" | "low" | "medium" | "high";
    faceSharp: boolean;
  };

  output: {
    aspectRatio: "1:1" | "4:5" | "3:2" | "16:9" | "9:16";
    setType: "single" | "two_by_two_grid" | "social_pack" | "hero_and_crops";
    quality: "draft" | "high";
  };

  randomization: {
    enabled: boolean;
    fields: {
      cameraAngle: boolean;
      crop: boolean;
      lightingDirection: boolean;
      backgroundType: boolean;
      pose: boolean;
      expression: boolean;
      motionIntensity: boolean;
      aspectRatio: boolean;
    };
    strength: "low" | "medium" | "high";
  };
}

// ── Default randomization (applied to all starters) ─────────────────────────

const DEFAULT_RANDOMIZATION: CampaignRecipe["randomization"] = {
  enabled: true,
  strength: "medium",
  fields: {
    cameraAngle: true,
    crop: true,
    lightingDirection: true,
    backgroundType: false,
    pose: true,
    expression: true,
    motionIntensity: true,
    aspectRatio: false,
  },
};

const NOW = "2025-01-01T00:00:00.000Z";

function starter(
  id: string,
  name: string,
  description: string,
  category: CampaignRecipeCategory,
  camera: CampaignRecipe["camera"],
  lighting: CampaignRecipe["lighting"],
  background: CampaignRecipe["background"],
  styling: CampaignRecipe["styling"],
  subject: CampaignRecipe["subject"],
  motion: CampaignRecipe["motion"],
  output: CampaignRecipe["output"],
): CampaignRecipe {
  return {
    id,
    name,
    description,
    category,
    isStarter: true,
    createdAt: NOW,
    updatedAt: NOW,
    camera,
    lighting,
    background,
    styling,
    subject,
    motion,
    output,
    randomization: DEFAULT_RANDOMIZATION,
  };
}

// ── 15 Starter Recipes ───────────────────────────────────────────────────────

export const STARTER_CAMPAIGN_RECIPES: CampaignRecipe[] = [
  starter(
    "cr-premium-sports",
    "Premium Sports Campaign",
    "Editorial-grade sports portrait with hard key lighting on a gradient background. Built for hero crops and campaign selects.",
    "editorial",
    { shotType: "medium",       lens: "85mm", angle: "eye_level",       crop: "standard" },
    { setup: "hard_key",        direction: "side_left",  contrast: "high"      },
    { type: "plain_gradient",   detailLevel: "minimal"                         },
    { wardrobe: "performance_wear",   colorPalette: "neutral",             skinRetouching: "polished" },
    { expression: "focused",    pose: "standing_power",  energy: "controlled"  },
    { enabled: false, type: "none", intensity: "none", faceSharp: true        },
    { aspectRatio: "4:5",       setType: "hero_and_crops", quality: "high"     },
  ),

  starter(
    "cr-clean-studio-portrait",
    "Clean Studio Portrait",
    "Soft front-lit studio portrait on white. Minimal and press-ready with natural retouching.",
    "portrait",
    { shotType: "close_up",     lens: "85mm", angle: "eye_level",       crop: "tight"    },
    { setup: "soft_studio",     direction: "front",      contrast: "medium"    },
    { type: "white",            detailLevel: "minimal"                         },
    { wardrobe: "minimal_black",      colorPalette: "neutral",             skinRetouching: "natural"  },
    { expression: "neutral",    pose: "standing_power",  energy: "calm"        },
    { enabled: false, type: "none", intensity: "none", faceSharp: true        },
    { aspectRatio: "4:5",       setType: "single",         quality: "high"     },
  ),

  starter(
    "cr-gritty-training",
    "Gritty Training Campaign",
    "Documentary-style gym environment with natural side lighting. Raw and authentic.",
    "documentary",
    { shotType: "medium",       lens: "50mm", angle: "eye_level",       crop: "standard" },
    { setup: "natural_light",   direction: "side_right",  contrast: "medium"   },
    { type: "gym",              detailLevel: "detailed"                        },
    { wardrobe: "training_wear",      colorPalette: "warm",                skinRetouching: "raw"      },
    { expression: "intense",    pose: "ready_position",  energy: "dynamic"     },
    { enabled: true, type: "frozen_action", intensity: "low", faceSharp: true },
    { aspectRatio: "3:2",       setType: "social_pack",    quality: "high"     },
  ),

  starter(
    "cr-motion-sprint",
    "Motion Sprint Campaign",
    "Full-body wide-angle sprint on track with directional motion blur conveying explosive speed.",
    "motion",
    { shotType: "full_body",    lens: "35mm", angle: "low_angle",       crop: "wide"     },
    { setup: "hard_key",        direction: "side_left",  contrast: "high"      },
    { type: "track",            detailLevel: "moderate"                        },
    { wardrobe: "performance_wear",   colorPalette: "cool",                skinRetouching: "natural"  },
    { expression: "intense",    pose: "in_motion",       energy: "explosive"   },
    { enabled: true, type: "motion_blur", intensity: "medium", faceSharp: true },
    { aspectRatio: "16:9",      setType: "hero_and_crops", quality: "high"     },
  ),

  starter(
    "cr-luxury-editorial",
    "Luxury Athlete Editorial",
    "Three-quarter body with soft side lighting on gradient. Polished luxury sportswear aesthetic.",
    "editorial",
    { shotType: "three_quarter", lens: "85mm", angle: "slight_high_angle", crop: "standard" },
    { setup: "soft_studio",     direction: "side_left",  contrast: "medium"    },
    { type: "plain_gradient",   detailLevel: "minimal"                         },
    { wardrobe: "luxury_sportswear",  colorPalette: "neutral",             skinRetouching: "polished" },
    { expression: "confident",  pose: "standing_power",  energy: "controlled"  },
    { enabled: false, type: "none", intensity: "none", faceSharp: true        },
    { aspectRatio: "4:5",       setType: "single",         quality: "high"     },
  ),

  starter(
    "cr-documentary-portrait",
    "Documentary Athlete Portrait",
    "Candid gym portrait with flat natural light. Seated, relaxed — captures the person behind the athlete.",
    "documentary",
    { shotType: "medium",       lens: "50mm", angle: "eye_level",       crop: "standard" },
    { setup: "natural_light",   direction: "front",      contrast: "low"       },
    { type: "gym",              detailLevel: "moderate"                        },
    { wardrobe: "training_wear",      colorPalette: "warm",                skinRetouching: "raw"      },
    { expression: "relaxed",    pose: "seated",          energy: "calm"        },
    { enabled: false, type: "none", intensity: "none", faceSharp: true        },
    { aspectRatio: "3:2",       setType: "single",         quality: "high"     },
  ),

  starter(
    "cr-arena-hero",
    "Arena Hero Campaign",
    "Full-body low-angle arena spotlight with dramatic overhead light. Built for broadcast and press.",
    "editorial",
    { shotType: "full_body",    lens: "50mm", angle: "low_angle",       crop: "wide"     },
    { setup: "arena_spotlight", direction: "overhead",   contrast: "very_high" },
    { type: "arena",            detailLevel: "detailed"                        },
    { wardrobe: "team_kit",           colorPalette: "brand_color_accent",  skinRetouching: "polished" },
    { expression: "confident",  pose: "standing_power",  energy: "controlled"  },
    { enabled: false, type: "none", intensity: "none", faceSharp: true        },
    { aspectRatio: "16:9",      setType: "hero_and_crops", quality: "high"     },
  ),

  starter(
    "cr-black-power-portrait",
    "Black Background Power Portrait",
    "Close-up 100mm portrait on solid black with extreme side contrast. Intense and authoritative.",
    "portrait",
    { shotType: "close_up",     lens: "100mm", angle: "eye_level",      crop: "tight"    },
    { setup: "high_contrast",   direction: "side_left",  contrast: "very_high" },
    { type: "black",            detailLevel: "minimal"                         },
    { wardrobe: "minimal_black",      colorPalette: "black_white",         skinRetouching: "natural"  },
    { expression: "intense",    pose: "arms_crossed",    energy: "controlled"  },
    { enabled: false, type: "none", intensity: "none", faceSharp: true        },
    { aspectRatio: "4:5",       setType: "single",         quality: "high"     },
  ),

  starter(
    "cr-outdoor-track",
    "Outdoor Track Campaign",
    "Full-body natural-light track campaign with frozen peak action. Authentic outdoor sports feel.",
    "motion",
    { shotType: "full_body",    lens: "35mm", angle: "eye_level",       crop: "wide"     },
    { setup: "natural_light",   direction: "front",      contrast: "medium"    },
    { type: "track",            detailLevel: "detailed"                        },
    { wardrobe: "performance_wear",   colorPalette: "cool",                skinRetouching: "natural"  },
    { expression: "focused",    pose: "ready_position",  energy: "dynamic"     },
    { enabled: true, type: "frozen_action", intensity: "medium", faceSharp: true },
    { aspectRatio: "3:2",       setType: "social_pack",    quality: "high"     },
  ),

  starter(
    "cr-product-launch",
    "Product Launch Athlete Campaign",
    "Three-quarter body on product set with clean front lighting. Polished and brand-safe.",
    "product",
    { shotType: "three_quarter", lens: "85mm", angle: "eye_level",      crop: "standard" },
    { setup: "soft_studio",     direction: "front",      contrast: "medium"    },
    { type: "product_set",      detailLevel: "moderate"                        },
    { wardrobe: "product_focused",    colorPalette: "brand_color_accent",  skinRetouching: "polished" },
    { expression: "confident",  pose: "hands_on_hips",   energy: "controlled"  },
    { enabled: false, type: "none", intensity: "none", faceSharp: true        },
    { aspectRatio: "4:5",       setType: "hero_and_crops", quality: "high"     },
  ),

  starter(
    "cr-magazine-cover",
    "Magazine Cover Portrait",
    "Medium shot with hard side-right lighting. Tight, editorial, and print-ready.",
    "editorial",
    { shotType: "medium",       lens: "85mm", angle: "eye_level",       crop: "tight"    },
    { setup: "hard_key",        direction: "side_right", contrast: "high"      },
    { type: "plain_gradient",   detailLevel: "minimal"                         },
    { wardrobe: "luxury_sportswear",  colorPalette: "neutral",             skinRetouching: "polished" },
    { expression: "confident",  pose: "standing_power",  energy: "controlled"  },
    { enabled: false, type: "none", intensity: "none", faceSharp: true        },
    { aspectRatio: "4:5",       setType: "single",         quality: "high"     },
  ),

  starter(
    "cr-social-grid",
    "Social Announcement Grid",
    "Four-pose 1:1 grid with hard key lighting. Built for social media launches and announcements.",
    "social",
    { shotType: "medium",       lens: "85mm", angle: "eye_level",       crop: "standard" },
    { setup: "hard_key",        direction: "side_left",  contrast: "high"      },
    { type: "plain_gradient",   detailLevel: "minimal"                         },
    { wardrobe: "performance_wear",   colorPalette: "brand_color_accent",  skinRetouching: "polished" },
    { expression: "confident",  pose: "standing_power",  energy: "controlled"  },
    { enabled: false, type: "none", intensity: "none", faceSharp: true        },
    { aspectRatio: "1:1",       setType: "two_by_two_grid", quality: "high"    },
  ),

  starter(
    "cr-high-contrast-fitness",
    "High Contrast Fitness Campaign",
    "Three-quarter body on concrete with extreme high-contrast black-and-white fitness aesthetic.",
    "portrait",
    { shotType: "three_quarter", lens: "50mm", angle: "low_angle",      crop: "standard" },
    { setup: "high_contrast",   direction: "side_left",  contrast: "very_high" },
    { type: "concrete",         detailLevel: "moderate"                        },
    { wardrobe: "training_wear",      colorPalette: "black_white",         skinRetouching: "raw"      },
    { expression: "intense",    pose: "hands_on_hips",   energy: "controlled"  },
    { enabled: false, type: "none", intensity: "none", faceSharp: true        },
    { aspectRatio: "4:5",       setType: "social_pack",    quality: "high"     },
  ),

  starter(
    "cr-minimal-performance",
    "Minimal Performance Portrait",
    "Soft front-lit medium portrait on gradient. Clean and calm — works as a base for any campaign.",
    "portrait",
    { shotType: "medium",       lens: "85mm", angle: "eye_level",       crop: "standard" },
    { setup: "soft_studio",     direction: "front",      contrast: "low"       },
    { type: "plain_gradient",   detailLevel: "minimal"                         },
    { wardrobe: "performance_wear",   colorPalette: "neutral",             skinRetouching: "natural"  },
    { expression: "focused",    pose: "standing_power",  energy: "calm"        },
    { enabled: false, type: "none", intensity: "none", faceSharp: true        },
    { aspectRatio: "4:5",       setType: "single",         quality: "high"     },
  ),

  starter(
    "cr-cinematic-night",
    "Cinematic Night Athlete Campaign",
    "Full-body night exterior with strobe flash and motion echo. Cinematic and dramatic.",
    "editorial",
    { shotType: "full_body",    lens: "50mm", angle: "low_angle",       crop: "wide"     },
    { setup: "night_flash",     direction: "side_right", contrast: "high"      },
    { type: "night_exterior",   detailLevel: "moderate"                        },
    { wardrobe: "performance_wear",   colorPalette: "cool",                skinRetouching: "polished" },
    { expression: "intense",    pose: "ready_position",  energy: "dynamic"     },
    { enabled: true, type: "motion_echo", intensity: "low", faceSharp: true   },
    { aspectRatio: "16:9",      setType: "hero_and_crops", quality: "high"     },
  ),
];
