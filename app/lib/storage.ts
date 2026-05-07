import { supabase } from "./supabase";

export const ASSETS_BUCKET  = "pluribus-assets-private";
export const EXPORTS_BUCKET = "pluribus-exports-private";

// ── Path builders ─────────────────────────────────────────────────────────────
// All paths are prefixed with userId so storage RLS (foldername[1] = uid) passes.

export function generatedAssetPath(userId: string, campaignId: string, outputId: string) {
  return `${userId}/campaigns/${campaignId}/generated/${outputId}.jpg`;
}

export function referenceImagePath(userId: string, athleteId: string, angleKey: string) {
  return `${userId}/subjects/${athleteId}/references/${angleKey}.jpg`;
}

export function likenessPath(
  userId: string,
  athleteId: string,
  type: "approved" | "rejected",
  outputId: string,
) {
  return `${userId}/subjects/${athleteId}/${type}_likeness/${outputId}.jpg`;
}

export function exportZipPath(userId: string, campaignId: string, filename: string) {
  return `${userId}/campaigns/${campaignId}/exports/${filename}`;
}

// ── Core helpers ──────────────────────────────────────────────────────────────

/** Mirror a fal.ai CDN URL to permanent Supabase Storage via the proxy. */
export async function mirrorAsset(
  falUrl: string,
  storagePath: string,
  bucket = ASSETS_BUCKET,
): Promise<{ path: string; signedUrl: string } | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  try {
    const res = await fetch("/storage/mirror", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ falUrl, storagePath, bucket }),
    });
    if (!res.ok) return null;
    return await res.json() as { path: string; signedUrl: string };
  } catch {
    return null;
  }
}

/** Upload a File/Blob directly to Supabase Storage (client-side, user JWT). */
export async function uploadFile(
  storagePath: string,
  file: File | Blob,
  mimeType = "image/jpeg",
  bucket = ASSETS_BUCKET,
): Promise<{ path: string; signedUrl: string } | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, { contentType: mimeType, upsert: true });
  if (error) {
    console.warn("[storage] upload failed:", error.message);
    return null;
  }
  const { data: signed } = await supabase.storage
    .from(bucket)
    .createSignedUrl(data.path, 365 * 24 * 3600);
  return signed?.signedUrl ? { path: data.path, signedUrl: signed.signedUrl } : null;
}

/** Refresh a signed URL for an existing storage path (1-hour default). */
export async function getSignedUrl(
  storagePath: string,
  expiresIn = 3600,
  bucket = ASSETS_BUCKET,
): Promise<string | null> {
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresIn);
  return data?.signedUrl ?? null;
}

/** Get the current user's UUID from the active session (or null). */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}
