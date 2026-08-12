"use server";

import { getSupabaseServer } from "@/lib/supabase/server";

/** Onboarding answers seed the Content DNA. They're merged into the Supabase
 * user's metadata (no extra table) and read back when building DNA v0. */
export type OnboardingAnswers = {
  field?: string;
  audience?: string;
  brandType?: string;
  dialect?: string;
  goals?: string[];
  platforms?: string[];
  frequency?: string;
  styles?: string[];
};

export type SaveOnboardingResult =
  | { ok: true }
  | { ok: false; error: "no_session" | "failed" };

export async function saveOnboarding(patch: OnboardingAnswers): Promise<SaveOnboardingResult> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { ok: false, error: "no_session" };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "no_session" };
  const prev = (data.user?.user_metadata?.onboarding ?? {}) as OnboardingAnswers;
  const { error } = await supabase.auth.updateUser({
    data: { onboarding: { ...prev, ...patch } },
  });
  return error ? { ok: false, error: "failed" } : { ok: true };
}

/** Null means there is no authenticated user. An empty object is a valid first
 * onboarding visit, so callers must not conflate the two. */
export async function getOnboarding(): Promise<OnboardingAnswers | null> {
  const supabase = await getSupabaseServer();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return (data.user?.user_metadata?.onboarding ?? {}) as OnboardingAnswers;
}
