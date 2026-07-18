"use server";

import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { ensureUserContext } from "./bootstrap";

export type AuthResult = { ok: true; needsConfirm?: boolean } | { ok: false; error: string };

export async function signIn(input: { email: string; password: string }): Promise<AuthResult> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { ok: false, error: "Auth is not configured." };
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });
  if (error) return { ok: false, error: error.message };
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
export async function requestPasswordReset(email: string): Promise<{ ok: true }> {
  const supabase = await getSupabaseServer();
  if (supabase && email.trim()) {
    try {
      await supabase.auth.resetPasswordForEmail(email.trim());
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

export async function signOut(locale: string): Promise<void> {
  const supabase = await getSupabaseServer();
  if (supabase) await supabase.auth.signOut();
  redirect(`/${locale === "en" ? "en" : "ar"}/login`);
}
