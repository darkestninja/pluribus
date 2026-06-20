import type { Moodboard, CreativeDirection } from "../../data/moodboard";
import { supabase } from "./supabase";

export function buildMoodboardPrompt(mb: Moodboard): string {
  const d = mb.direction;
  const lines: string[] = [`Creative Direction (moodboard: "${mb.name}"):`];

  if (d?.mood)         lines.push(`Mood: ${d.mood}`);
  if (d?.colorPalette) lines.push(`Colour palette: ${d.colorPalette}`);
  if (d?.lighting)     lines.push(`Lighting: ${d.lighting}`);
  if (d?.composition)  lines.push(`Composition: ${d.composition}`);
  if (d?.style)        lines.push(`Style: ${d.style}`);
  if (d?.environment)  lines.push(`Environment: ${d.environment}`);
  if (mb.notes.trim()) lines.push(`Additional direction: ${mb.notes.trim()}`);

  // If no analyzed direction and no notes but images exist, add a generic style cue
  // so the moodboard still influences generation even without AI analysis
  if (!d && !mb.notes.trim() && mb.sources.length > 0) {
    lines.push("Match the visual aesthetic, colour grading, lighting mood, and atmosphere from this moodboard.");
  }

  // Only omit entirely if nothing to contribute at all
  if (lines.length === 1 && mb.sources.length === 0) return "";

  return lines.join("\n");
}

export async function analyzeMoodboardImages(
  thumbnails: string[],
): Promise<CreativeDirection | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || thumbnails.length === 0) return null;

  const images = thumbnails.map(t => {
    const [header, b64] = t.split(",");
    return { base64: b64 ?? t, mimeType: header?.match(/data:([^;]+)/)?.[1] ?? "image/jpeg" };
  }).filter(i => i.base64);

  try {
    const res = await fetch("/analyze/moodboard", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ images }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { ok: boolean; direction?: CreativeDirection };
    return data.ok && data.direction ? data.direction : null;
  } catch {
    return null;
  }
}

export async function fetchUrlImages(
  url: string,
): Promise<Array<{ thumbnail: string; sourceUrl: string }>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];

  try {
    const res = await fetch("/fetch/url", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return [];
    const data = await res.json() as { ok: boolean; sources?: Array<{ dataUrl: string; sourceUrl: string }> };
    return data.ok && data.sources ? data.sources.map(s => ({ thumbnail: s.dataUrl, sourceUrl: s.sourceUrl })) : [];
  } catch {
    return [];
  }
}

/** Resize an image dataUrl on the client to max 512px side, JPEG 0.82. */
export function resizeDataUrl(dataUrl: string, maxSize = 512): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
