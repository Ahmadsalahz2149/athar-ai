"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client (used for OAuth redirects). Returns null when the
 * project env isn't configured, so the UI can degrade gracefully. */
export function getSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
