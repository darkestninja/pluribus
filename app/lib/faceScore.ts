import { supabase } from "./supabase";

export interface FaceScoreResult {
  score: number;
  confidence: "high" | "medium" | "low";
  keyMatches: string[];
  keyDifferences: string[];
}

/**
 * Uses Claude vision to compare two faces on structural identity.
 * Ignores lighting, pose, expression, color, style.
 * Reference can be a data URL (base64) or an HTTP URL.
 */
export async function computeResemblanceScore(
  referenceUrl: string,
  generatedUrl: string,
): Promise<number | null> {
  try {
    const result = await compareFaces(referenceUrl, generatedUrl);
    return result?.score ?? null;
  } catch {
    return null;
  }
}

export async function compareFaces(
  referenceUrl: string,
  generatedUrl: string,
): Promise<FaceScoreResult | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";

  // Data URLs are sent as base64 directly; HTTP URLs are fetched server-side
  const isDataUrl = referenceUrl.startsWith("data:");
  const body = isDataUrl
    ? {
        referenceBase64: referenceUrl.split(",")[1],
        referenceMime: referenceUrl.match(/data:([^;]+)/)?.[1] ?? "image/jpeg",
        generatedUrl,
      }
    : { referenceUrl, generatedUrl };

  const res = await fetch("/analyze/face-compare", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;
  const data = await res.json() as { ok: boolean; score?: number; confidence?: string; keyMatches?: string[]; keyDifferences?: string[] };
  if (!data.ok || data.score == null) return null;

  return {
    score: data.score,
    confidence: (data.confidence ?? "low") as FaceScoreResult["confidence"],
    keyMatches: data.keyMatches ?? [],
    keyDifferences: data.keyDifferences ?? [],
  };
}

export function clearRefCache() { /* no-op — server handles caching */ }
