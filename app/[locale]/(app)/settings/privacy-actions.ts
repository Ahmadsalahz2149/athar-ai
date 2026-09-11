"use server";

import { db } from "@/lib/db";
import { currentContext } from "@/lib/auth/current";
import { getSupabaseServer } from "@/lib/supabase/server";
import { buildExport } from "@/lib/gdpr/export";
import { eraseAccount } from "@/lib/gdpr/erase";
import { consume } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { log } from "@/lib/log";

/**
 * Self-service privacy rights: export everything we hold (GDPR art. 15/20) and
 * erase the account (art. 17). Both resolve the caller's workspace server-side —
 * nothing about *which* account to touch comes from the client.
 */

export type ExportResult = { ok: true; filename: string; json: string } | { ok: false; error: string };

export async function exportMyData(): Promise<ExportResult> {
  if (!db) return { ok: false, error: "unavailable" };
  const ctx = await currentContext();
  if (!ctx) return { ok: false, error: "no_session" };

  // Building an export scans every table for the workspace; keep it from being
  // used as an amplification lever.
  const ip = await clientIp();
  if (!consume(`export:${ctx.orgId}:${ip}`, 3, 60 * 60_000).ok) {
    return { ok: false, error: "rate_limited" };
  }

  const supabase = await getSupabaseServer();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const user = data.user;
  if (!user) return { ok: false, error: "no_session" };

  try {
    const doc = await buildExport(db, ctx.orgId, {
      id: user.id,
      email: user.email ?? undefined,
      metadata: user.user_metadata,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    return { ok: true, filename: `athar-data-export-${stamp}.json`, json: JSON.stringify(doc, null, 2) };
  } catch (e) {
    log.error("gdpr.export_failed", { orgId: ctx.orgId }, e);
    return { ok: false, error: "failed" };
  }
}

export type DeleteResult = { ok: true } | { ok: false; error: "no_session" | "confirm_mismatch" | "failed" | "rate_limited" };

/**
 * Permanently erase the caller's account. `confirmEmail` must match the signed-in
 * address — checked here rather than in the browser, so the confirmation cannot
 * be skipped by calling this action directly.
 */
export async function deleteMyAccount(confirmEmail: string): Promise<DeleteResult> {
  if (!db) return { ok: false, error: "failed" };
  const ctx = await currentContext();
  if (!ctx) return { ok: false, error: "no_session" };

  const supabase = await getSupabaseServer();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const user = data.user;
  if (!user?.email) return { ok: false, error: "no_session" };

  const ip = await clientIp();
  if (!consume(`delete:${user.id}:${ip}`, 5, 60 * 60_000).ok) return { ok: false, error: "rate_limited" };

  if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, error: "confirm_mismatch" };
  }

  const res = await eraseAccount(db, ctx.orgId, user.id);
  if (!res.ok) return { ok: false, error: "failed" };

  log.info("gdpr.account_erased", {
    orgDeleted: res.orgDeleted,
    authDeleted: res.authDeleted,
    rows: Object.values(res.deleted).reduce((a, b) => a + b, 0),
  });

  // Drop the local session so the browser isn't left holding a token for an
  // account that no longer exists.
  try {
    await supabase?.auth.signOut();
  } catch {
    /* the account is already gone; a failed sign-out must not fail the request */
  }
  return { ok: true };
}
