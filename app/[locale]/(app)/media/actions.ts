"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { estimateVoice, estimateImage, estimateVideo } from "@/lib/credits/costs";
import { textToSpeech, hasTtsKey } from "@/lib/ai/tts";
import { generateImages, hasImageKey, type ImageAspect } from "@/lib/ai/image";
import { submitVideo, queryVideo, retrieveVideoUrl, hasVideoKey, VideoCreditsError } from "@/lib/ai/video";
import { uploadPublic } from "@/lib/storage/uploads";
import { generateText, hasKeyFor, currentProvider } from "@/lib/ai/generate";
import { MODELS } from "@/lib/ai/models";
import { IMAGE_PROMPT_SYSTEM, buildImagePromptMessage, buildBrandContext } from "@/lib/ai/prompts";

type Ctx = { db: NonNullable<typeof db>; ctx: { orgId: string; brandId: string } };
async function ctxOrNull(): Promise<Ctx | null> {
  if (!db) return null;
  const ctx = await currentContext();
  if (!ctx) return null;
  return { db, ctx };
}

/** Persist bytes to the public bucket; returns a durable URL (throws on failure). */
async function persist(kind: string, ext: string, contentType: string, bytes: Uint8Array): Promise<string> {
  return uploadPublic(`media/${kind}/${randomUUID()}.${ext}`, bytes, contentType);
}

/** Voice-over: text → MP3, persisted to the gallery. Optionally linked to a draft. */
export async function generateVoice(text: string, voiceId?: string, draftId?: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    if (!hasTtsKey()) return { ok: false, error: "no_key" };
    if (!text?.trim() || text.trim().length < 4) return { ok: false, error: "empty" };
    const c = await ctxOrNull();
    if (!c) return { ok: false, error: "no_session" };
    const t = forOrg(c.db, c.ctx.orgId);
    if ((await t.balance()) < estimateVoice()) return { ok: false, error: "insufficient_credits" };
    const bytes = await textToSpeech(text.trim(), { voiceId });
    // Persist to the durable gallery; fall back to a data URI if storage is down.
    let url: string;
    try {
      url = await persist("voice", "mp3", "audio/mpeg", bytes);
      await t.saveMediaAsset(c.ctx.brandId, { kind: "voice", url, prompt: text.trim().slice(0, 200), draftId: draftId ?? null });
    } catch {
      url = `data:audio/mpeg;base64,${Buffer.from(bytes).toString("base64")}`;
    }
    await t.debit(estimateVoice(), "voice_over", "brand", c.ctx.brandId);
    revalidatePath("/media");
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Image studio: prompt → images, re-hosted on our bucket + saved to the gallery. */
export async function generateImage(prompt: string, aspect?: ImageAspect, n?: number, draftId?: string): Promise<{ ok: true; urls: string[] } | { ok: false; error: string }> {
  try {
    if (!hasImageKey()) return { ok: false, error: "no_key" };
    if (!prompt?.trim()) return { ok: false, error: "empty" };
    const c = await ctxOrNull();
    if (!c) return { ok: false, error: "no_session" };
    const t = forOrg(c.db, c.ctx.orgId);
    if ((await t.balance()) < estimateImage()) return { ok: false, error: "insufficient_credits" };
    const srcUrls = await generateImages(prompt.trim(), { aspectRatio: aspect, n });
    if (!srcUrls.length) return { ok: false, error: "failed" };
    // MiniMax URLs are temporary — re-host each on our bucket for a durable gallery.
    const urls: string[] = [];
    for (const src of srcUrls) {
      try {
        const res = await fetch(src);
        const bytes = new Uint8Array(await res.arrayBuffer());
        const url = await persist("image", "png", res.headers.get("content-type") || "image/png", bytes);
        await t.saveMediaAsset(c.ctx.brandId, { kind: "image", url, prompt: prompt.trim().slice(0, 200), draftId: draftId ?? null });
        urls.push(url);
      } catch {
        urls.push(src); // keep the source URL if re-hosting fails
      }
    }
    await t.debit(estimateImage(), "image_gen", "brand", c.ctx.brandId);
    revalidatePath("/media");
    return { ok: true, urls };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Turn a post into a brand-appropriate English image prompt (content → media). */
export async function suggestImagePrompt(text: string): Promise<{ ok: true; prompt: string } | { ok: false; error: string }> {
  try {
    const provider = currentProvider();
    if (!hasKeyFor(provider)) return { ok: false, error: "no_key" };
    if (!text?.trim()) return { ok: false, error: "empty" };
    const c = await ctxOrNull();
    if (!c) return { ok: false, error: "no_session" };
    const t = forOrg(c.db, c.ctx.orgId);
    let brand: string | undefined;
    try {
      const [profile, products] = await Promise.all([t.getBrandProfile(c.ctx.brandId), t.listProducts(c.ctx.brandId)]);
      brand = buildBrandContext({ profile, products }) || undefined;
    } catch {
      /* best-effort */
    }
    const res = await generateText({
      system: IMAGE_PROMPT_SYSTEM,
      user: buildImagePromptMessage({ postText: text, brand }),
      maxTokens: 300,
      anthropicModel: process.env.ANTHROPIC_DRAFT_MODEL || MODELS.HAIKU,
      provider,
    });
    const prompt = res.text.trim().replace(/^["']|["']$/g, "");
    if (!prompt) return { ok: false, error: "failed" };
    return { ok: true, prompt };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Video studio: submit a text-to-video task; returns a task id to poll. */
export async function startVideo(prompt: string): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  try {
    if (!hasVideoKey()) return { ok: false, error: "no_key" };
    if (!prompt?.trim()) return { ok: false, error: "empty" };
    const c = await ctxOrNull();
    if (!c) return { ok: false, error: "no_session" };
    const t = forOrg(c.db, c.ctx.orgId);
    if ((await t.balance()) < estimateVideo()) return { ok: false, error: "insufficient_credits" };
    const taskId = await submitVideo(prompt.trim());
    await t.debit(estimateVideo(), "video_gen", "brand", c.ctx.brandId);
    return { ok: true, taskId };
  } catch (e) {
    if (e instanceof VideoCreditsError) return { ok: false, error: "needs_credits" };
    return { ok: false, error: (e as Error).message };
  }
}

/** Poll a video task; on success save it to the gallery and return its URL. */
export async function pollVideo(taskId: string, prompt?: string, draftId?: string): Promise<{ status: string; url?: string }> {
  try {
    const s = await queryVideo(taskId);
    if (s.status === "success" && s.fileId) {
      const url = await retrieveVideoUrl(s.fileId);
      if (url) {
        const c = await ctxOrNull();
        if (c) await forOrg(c.db, c.ctx.orgId).saveMediaAsset(c.ctx.brandId, { kind: "video", url, prompt: prompt?.slice(0, 200) ?? null, draftId: draftId ?? null }).catch(() => {});
        revalidatePath("/media");
      }
      return { status: "success", url: url ?? undefined };
    }
    return { status: s.status };
  } catch {
    return { status: "fail" };
  }
}

/** Remove an asset from the gallery. */
export async function deleteAsset(assetId: string): Promise<{ ok: boolean }> {
  try {
    const c = await ctxOrNull();
    if (!c) return { ok: false };
    await forOrg(c.db, c.ctx.orgId).deleteMediaAsset(c.ctx.brandId, assetId);
    revalidatePath("/media");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
