"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { normalizeProfile, type BrandProfile } from "@/lib/brand/profile";
import { uploadPublic } from "@/lib/storage/uploads";

type Res<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

async function ctxOrThrow() {
  if (!db) throw new Error("no_db");
  const ctx = await currentContext();
  if (!ctx) throw new Error("no_session");
  return { db, ctx };
}

/** Save the full brand profile (constraints, production notes, team size,
 * 3-level descriptions, identity Q&A). */
export async function saveBrandProfile(profile: BrandProfile): Promise<Res> {
  try {
    const { db, ctx } = await ctxOrThrow();
    await forOrg(db, ctx.orgId).setBrandProfile(ctx.brandId, normalizeProfile(profile));
    revalidatePath("/brand");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function saveProduct(p: {
  id?: string;
  name: string;
  kind?: string;
  description?: string | null;
  price?: string | null;
  url?: string | null;
}): Promise<Res<{ id: string }>> {
  try {
    if (!p.name?.trim()) return { ok: false, error: "name_required" };
    const { db, ctx } = await ctxOrThrow();
    const id = await forOrg(db, ctx.orgId).saveProduct(ctx.brandId, p);
    revalidatePath("/brand");
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteProduct(productId: string): Promise<Res> {
  try {
    const { db, ctx } = await ctxOrThrow();
    await forOrg(db, ctx.orgId).deleteProduct(ctx.brandId, productId);
    revalidatePath("/brand");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
const LOGO_MAX = 512 * 1024; // 512KB — stored inline as a data URI, no bucket needed.

/** Upload (or clear) the brand logo. Stored as a data URI in the brand row so
 * it renders everywhere with no public bucket / signed-URL plumbing. */
export async function uploadLogo(form: FormData): Promise<Res<{ logoUrl: string | null }>> {
  try {
    const { db, ctx } = await ctxOrThrow();
    const file = form.get("logo");
    if (!(file instanceof File) || file.size === 0) {
      await forOrg(db, ctx.orgId).setBrandLogo(ctx.brandId, null);
      revalidatePath("/brand");
      return { ok: true, data: { logoUrl: null } };
    }
    if (!LOGO_TYPES.includes(file.type)) return { ok: false, error: "bad_type" };
    if (file.size > LOGO_MAX) return { ok: false, error: "too_large" };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = (file.type.split("/")[1] || "png").replace("+xml", "");
    // Prefer a public storage URL (keeps the DB row light); fall back to an
    // inline data URI when storage isn't available so the feature never breaks.
    let logoUrl: string;
    try {
      logoUrl = await uploadPublic(`logos/${ctx.brandId}.${ext}`, bytes, file.type);
    } catch {
      logoUrl = `data:${file.type};base64,${Buffer.from(bytes).toString("base64")}`;
    }
    await forOrg(db, ctx.orgId).setBrandLogo(ctx.brandId, logoUrl);
    revalidatePath("/brand");
    return { ok: true, data: { logoUrl } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// --- Multi-brand (#15) ---

export async function createBrand(name: string): Promise<Res<{ id: string }>> {
  try {
    const { db, ctx } = await ctxOrThrow();
    const t = forOrg(db, ctx.orgId);
    const id = await t.createBrand(name);
    // Switch to the new brand immediately.
    (await cookies()).set("active_brand", id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    revalidatePath("/brand");
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function renameBrand(brandId: string, name: string): Promise<Res> {
  try {
    if (!name?.trim()) return { ok: false, error: "name_required" };
    const { db, ctx } = await ctxOrThrow();
    await forOrg(db, ctx.orgId).renameBrand(brandId, name);
    revalidatePath("/brand");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Set the active brand cookie (used by currentContext across all screens). */
export async function switchBrand(brandId: string): Promise<Res> {
  try {
    const { db, ctx } = await ctxOrThrow();
    // Validate ownership before trusting the id in the cookie.
    const b = await forOrg(db, ctx.orgId).getBrand(brandId);
    if (!b) return { ok: false, error: "not_found" };
    (await cookies()).set("active_brand", brandId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
