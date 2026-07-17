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

export async function saveOnboarding(patch: OnboardingAnswers): Promise<{ ok: boolean }> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { ok: false };
  const { data } = await supabase.auth.getUser();
  const prev = (data.user?.user_metadata?.onboarding ?? {}) as OnboardingAnswers;
  const { error } = await supabase.auth.updateUser({
    data: { onboarding: { ...prev, ...patch } },
  });
  return { ok: !error };
}

export async function getOnboarding(): Promise<OnboardingAnswers> {
  const supabase = await getSupabaseServer();
  if (!supabase) return {};
  const { data } = await supabase.auth.getUser();
  return (data.user?.user_metadata?.onboarding ?? {}) as OnboardingAnswers;
}
