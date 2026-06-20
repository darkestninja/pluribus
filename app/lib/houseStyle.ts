export interface HouseStyle {
  version: string;
  promptBlock: string;
  negativePromptBlock: string;
  /** fal CDN URLs — 3 locked style reference images used alongside identity refs in Nano Banana */
  styleReferenceUrls: string[];
  createdAt: string;
  notes: string;
}

export const HOUSE_STYLE_V1: HouseStyle = {
  version: "v1",
  promptBlock:
    "medium format film aesthetic, Kodak Portra 400 emulsion, fine organic grain, " +
    "85mm portrait perspective with shallow depth of field, " +
    "single directional key light from camera left with deep shadow falloff on the right, " +
    "no fill light, no rim light, no backlight, physically achievable lighting only, " +
    "warm amber highlights, cool blue-green shadows, gentle teal-orange split-tone, " +
    "low-saturation editorial color grade, " +
    "natural skin texture, visible pores, no beauty retouching, no smoothing, no clarity boost, " +
    "deep clean blacks, subtle highlight bloom, organic film grain at 20%, " +
    "photographic realism, editorial portrait sensibility, " +
    "not commercial, not lifestyle, not stock photography, not fashion advertising",
  negativePromptBlock:
    "digital clean look, HDR, oversaturated, vibrant colors, " +
    "multiple light sources, soft fill light, rim light, backlight, ring light, " +
    "beauty retouching, smooth skin, plastic skin, airbrushed, clarity boost, " +
    "extreme wide angle, fisheye, top-down, low angle dramatic, " +
    "commercial photography, stock photography, lifestyle photography, " +
    "fashion editorial, glamour, social media filter, Instagram aesthetic, " +
    "illustration, painting, CGI, 3D render, AI-generated look, " +
    "text, watermark, logo, signature",
  // Populate these with fal CDN URLs once 3 style reference images are shot/curated.
  // Until then generation works without style conditioning — just leave empty.
  styleReferenceUrls: [],
  createdAt: "2026-05-12",
  notes: "v1 — medium format film, Portra 400 emulsion, single key from camera left, " +
    "teal-orange split-tone, natural skin texture, not commercial",
};

export const ACTIVE_HOUSE_STYLE = HOUSE_STYLE_V1;
