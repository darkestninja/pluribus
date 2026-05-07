import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";

// ── Public user shape used throughout the UI ───────────────────────────────

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  org: string;
  avatarInitials: string;
}

export function toAppUser(user: User): AppUser {
  const name = (user.user_metadata?.full_name as string | undefined)
    ?? user.email?.split("@")[0]
    ?? "User";
  return {
    id:             user.id,
    name,
    email:          user.email ?? "",
    role:           (user.user_metadata?.role as AppUser["role"]) ?? "editor",
    org:            (user.user_metadata?.org  as string)          ?? "My Organisation",
    avatarInitials: name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase(),
  };
}

// ── Auth actions ───────────────────────────────────────────────────────────

export async function signIn(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Signup goes through the proxy so we can auto-confirm the email
 * (bypassing Supabase's confirmation email) and send a welcome email via Resend.
 * The proxy creates the user via the admin API, then the frontend signs in normally.
 */
export async function signUp(
  name: string,
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json() as { ok: boolean; error?: string };
  if (!data.ok) return data;

  // Now sign in via Supabase client to get a proper session
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function resetPassword(email: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// Re-export for App.tsx convenience
export { supabase };
