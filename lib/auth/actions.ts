"use server";

import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { ensureUserContext } from "./bootstrap";

/** `code` lets the client show a specific, localized message; `error` is the raw
 * fallback text for anything unmapped. */
export type SignInCode = "invalid" | "unconfirmed" | "not_configured" | "rate_limited" | "other";
export type AuthResult = { ok: true; needsConfirm?: boolean } | { ok: false; error: string; code?: SignInCode };

export async function signIn(input: { email: string; password: string }): Promise<AuthResult> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { ok: false, error: "Auth is not configured.", code: "not_configured" };
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });
  if (error) {
    const m = error.message.toLowerCase();
    const code: SignInCode = m.includes("invalid login") || m.includes("invalid credentials")
      ? "invalid"
      : m.includes("not confirmed") || m.includes("confirm")
      ? "unconfirmed"
      : m.includes("rate") || error.status === 429
      ? "rate_limited"
      : "other";
    return { ok: false, error: error.message, code };
  }
  if (data.user) await ensureUserContext(data.user.id, data.user.email ?? undefined);
  return { ok: true };
}

export async function signUp(input: {
  email: string;
  password: string;
  fullName?: string;
  accountType?: string;
}): Promise<AuthResult> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { ok: false, error: "Auth is not configured." };
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    // Persist profile bits on the auth user so the app chrome can show a real
    // name/role without another table (Settings can edit these later).
    options: {
      data: {
        full_name: input.fullName?.trim() || undefined,
        account_type: input.accountType || undefined,
      },
    },
  });
  if (error) return { ok: false, error: error.message };
  // With email confirmation ON, there is no session yet.
  if (!data.session) return { ok: true, needsConfirm: true };
  if (data.user) {
    await ensureUserContext(data.user.id, input.fullName?.trim() || data.user.email || undefined);
  }
  return { ok: true };
}

/** Always report success (don't leak whether the email exists). Real delivery
 * depends on Supabase SMTP being configured (needs intervention otherwise). */
export async function requestPasswordReset(email: string, locale = "ar"): Promise<{ ok: true }> {
  const supabase = await getSupabaseServer();
  if (supabase && email.trim()) {
    // The recovery link must land on our /reset-password page so the user can
    // actually set a new password. Base URL comes from OAUTH_BASE_URL (same as
    // the social callbacks); this URL must be in Supabase's allowed redirects.
    const base = (process.env.OAUTH_BASE_URL || "https://athargrowth.com").replace(/\/$/, "");
    const loc = locale === "en" ? "en" : "ar";
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${base}/${loc}/reset-password` });
    } catch {
      /* swallow — never leak existence */
    }
  }
  return { ok: true };
}

/** Update the signed-in user's display profile (name + title + bio) — stored on
 * the Supabase user, so the app chrome reflects real values. */
export async function updateProfile(input: { fullName: string; title: string; bio: string }): Promise<{ ok: boolean }> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { ok: false };
  const { error } = await supabase.auth.updateUser({
    data: { full_name: input.fullName.trim(), title: input.title.trim(), bio: input.bio.trim() },
  });
  return { ok: !error };
}

/** Persist notification preferences to the Supabase user (cross-device). */
export async function updateNotifications(prefs: Record<string, boolean>): Promise<{ ok: boolean }> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { ok: false };
  const { error } = await supabase.auth.updateUser({ data: { notifications: prefs } });
  return { ok: !error };
}

export async function signOut(locale: string): Promise<void> {
  const supabase = await getSupabaseServer();
  if (supabase) await supabase.auth.signOut();
  redirect(`/${locale === "en" ? "en" : "ar"}/login`);
}
