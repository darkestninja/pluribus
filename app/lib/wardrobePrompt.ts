import type { WardrobeKit, ClothingItem, LogoPlacement } from "../../data/wardrobe";
import { CLOTHING_META, PALETTE } from "../../data/wardrobe";

// ── Helpers ───────────────────────────────────────────────────────────────────

function colorLabel(id: string): string {
  return PALETTE.find(c => c.id === id)?.label ?? id;
}

function describeItem(item: ClothingItem): string {
  const meta    = CLOTHING_META[item.type];
  const primary = colorLabel(item.primaryColor);
  const fit     = item.fit && item.fit !== "standard" ? `${item.fit} ` : "";
  const sec     = item.secondaryColor ? ` with ${colorLabel(item.secondaryColor)} accents` : "";
  return `${primary} ${fit}${meta.promptLabel}${sec}`;
}

const PLACEMENT_LABEL: Record<LogoPlacement, string> = {
  chest_left:   "left chest",
  chest_center: "center chest",
  back:         "back",
  sleeve_left:  "left sleeve",
};

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns the data URLs to use as image references for an upload-mode wardrobe kit. */
export function getWardrobeRefImages(kit: WardrobeKit): string[] {
  if (kit.mode !== "upload") return [];
  if (kit.uploadDataUrls && kit.uploadDataUrls.length > 0) return kit.uploadDataUrls;
  if (kit.uploadDataUrl) return [kit.uploadDataUrl];
  return [];
}

export function buildWardrobePrompt(kit: WardrobeKit): string {
  if (kit.mode === "upload") {
    // If images exist, wardrobe is passed as image reference — no text prompt needed
    const hasImages = (kit.uploadDataUrls && kit.uploadDataUrls.length > 0) || !!kit.uploadDataUrl;
    if (hasImages) return "";
    return kit.uploadDescription?.trim()
      ? `Wardrobe: ${kit.uploadDescription.trim()}.`
      : "";
  }

  if (kit.items.length === 0) return "";

  // Group: sort tops before bottoms before accessories
  const ORDER = ["onepiece", "top", "bottom", "footwear", "accessory"];
  const sorted = [...kit.items].sort((a, b) => {
    const ai = ORDER.indexOf(CLOTHING_META[a.type]?.category ?? "accessory");
    const bi = ORDER.indexOf(CLOTHING_META[b.type]?.category ?? "accessory");
    return ai - bi;
  });

  const itemText = sorted.map(describeItem).join(", ");

  let logoText = "";
  if (kit.logo) {
    const brand   = kit.logo.brand?.trim() ? `${kit.logo.brand} ` : "";
    const place   = PLACEMENT_LABEL[kit.logo.placement];
    logoText = `. ${brand}logo on ${place}`;
  }

  return `Wardrobe: wearing ${itemText}${logoText}.`;
}

// ── Garment image analysis (calls proxy) ──────────────────────────────────────

export async function analyzeGarmentImage(
  dataUrl: string,
  accessToken: string,
): Promise<string | null> {
  const [header, imageBase64] = dataUrl.split(",");
  if (!imageBase64) return null;
  const mimeType = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";

  try {
    const res = await fetch("/analyze/garment", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ imageBase64, mimeType }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { ok: boolean; description?: string };
    return data.ok && data.description ? data.description : null;
  } catch {
    return null;
  }
}
