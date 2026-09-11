"use server";

import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { consume, LIMITS } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { ensureUserContext } from "./bootstrap";
import { capStr } from "@/lib/text/cap";

/** `code` lets the client show a specific, localized message; `error` is the raw
 * fallback text for anything unmapped. */
export type SignInCode = "invalid" | "unconfirmed" | "not_configured" | "rate_limited" | "other";

/** Normalize an email for rate-limit keys so casing/spacing can't split buckets. */
const emailKey = (e: string) => e.trim().toLowerCase();
export type AuthResult = { ok: true; needsConfirm?: boolean } | { ok: false; error: string; code?: SignInCode };

export async function signIn(input: { email: string; password: string }): Promise<AuthResult> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { ok: false, error: "Auth is not configured.", code: "not_configured" };
  // Throttle before touching Supabase: per IP, and per email so a targeted
  // brute force that rotates IPs is still capped.
  const ip = await clientIp();
  const byIp = consume(`signin:ip:${ip}`, LIMITS.signInIp.limit, LIMITS.signInIp.windowMs);
  const byEmail = consume(`signin:email:${emailKey(input.email)}`, LIMITS.signInEmail.limit, LIMITS.signInEmail.windowMs);
  if (!byIp.ok || !byEmail.ok) return { ok: false, error: "Too many attempts. Please try again later.", code: "rate_limited" };
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
  const ip = await clientIp();
  if (!consume(`signup:ip:${ip}`, LIMITS.signUpIp.limit, LIMITS.signUpIp.windowMs).ok) {
    return { ok: false, error: "Too many attempts. Please try again later.", code: "rate_limited" };
  }
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
  // The browser cooldown was advisory only — this action could be called
  // directly. Throttle here, and keep returning ok:true either way so a
  // throttled caller still learns nothing about whether the address exists.
  const ip = await clientIp();
  const allowed =
    consume(`reset:ip:${ip}`, LIMITS.resetIp.limit, LIMITS.resetIp.windowMs).ok &&
    consume(`reset:email:${emailKey(email)}`, LIMITS.resetEmail.limit, LIMITS.resetEmail.windowMs).ok;
  if (supabase && email.trim() && allowed) {
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
 * the Supabase user, so the app chrome reflects real values. Bounded like every
 * other stored free text: this lands in user_metadata and is rendered in the
 * app chrome on every page. */
export async function updateProfile(input: { fullName: string; title: string; bio: string }): Promise<{ ok: boolean }> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { ok: false };
  const { error } = await supabase.auth.updateUser({
    data: {
      full_name: capStr(input.fullName, 120).trim(),
      title: capStr(input.title, 120).trim(),
      bio: capStr(input.bio, 600).trim(),
    },
  });
  return { ok: !error };
}

/** The notification toggles the settings screen offers. Anything else sent by a
 * caller is dropped rather than stored — this is a fixed set of switches, not a
 * key-value store the browser may fill. */
const NOTIFICATION_KEYS = ["analysis", "schedule", "weekly", "marketing"] as const;

/** Persist notification preferences to the Supabase user (cross-device). */
export async function updateNotifications(prefs: Record<string, boolean>): Promise<{ ok: boolean }> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { ok: false };
  const notifications: Record<string, boolean> = {};
  for (const k of NOTIFICATION_KEYS) notifications[k] = prefs?.[k] === true;
  const { error } = await supabase.auth.updateUser({ data: { notifications } });
  return { ok: !error };
}

export async function signOut(locale: string): Promise<void> {
  const supabase = await getSupabaseServer();
  if (supabase) await supabase.auth.signOut();
  redirect(`/${locale === "en" ? "en" : "ar"}/login`);
}
