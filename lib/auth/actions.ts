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

export async function signUp(input: { email: string; password: string }): Promise<AuthResult> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { ok: false, error: "Auth is not configured." };
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
  });
  if (error) return { ok: false, error: error.message };
  // With email confirmation ON, there is no session yet.
  if (!data.session) return { ok: true, needsConfirm: true };
  if (data.user) await ensureUserContext(data.user.id, data.user.email ?? undefined);
  return { ok: true };
}

export async function signOut(locale: string): Promise<void> {
  const supabase = await getSupabaseServer();
  if (supabase) await supabase.auth.signOut();
  redirect(`/${locale === "en" ? "en" : "ar"}/login`);
}
