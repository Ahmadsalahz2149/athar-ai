"use server";

import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { estimateVoice, estimateImage, estimateVideo } from "@/lib/credits/costs";
import { textToSpeech, hasTtsKey } from "@/lib/ai/tts";
import { generateImages, hasImageKey, type ImageAspect } from "@/lib/ai/image";
import { submitVideo, queryVideo, retrieveVideoUrl, hasVideoKey, VideoCreditsError } from "@/lib/ai/video";

type Ctx = { db: NonNullable<typeof db>; ctx: { orgId: string; brandId: string } };
async function ctxOrNull(): Promise<Ctx | null> {
  if (!db) return null;
  const ctx = await currentContext();
  if (!ctx) return null;
  return { db, ctx };
}

/** Voice-over: text → MP3, returned as a data URI the client can play/download. */
export async function generateVoice(text: string, voiceId?: string): Promise<{ ok: true; audio: string } | { ok: false; error: string }> {
  try {
    if (!hasTtsKey()) return { ok: false, error: "no_key" };
    if (!text?.trim() || text.trim().length < 4) return { ok: false, error: "empty" };
    const c = await ctxOrNull();
    if (!c) return { ok: false, error: "no_session" };
    const t = forOrg(c.db, c.ctx.orgId);
    if ((await t.balance()) < estimateVoice()) return { ok: false, error: "insufficient_credits" };
    const bytes = await textToSpeech(text.trim(), { voiceId });
    const audio = `data:audio/mpeg;base64,${Buffer.from(bytes).toString("base64")}`;
    await t.debit(estimateVoice(), "voice_over", "brand", c.ctx.brandId);
    return { ok: true, audio };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Image studio: prompt → hosted image URLs. */
export async function generateImage(prompt: string, aspect?: ImageAspect, n?: number): Promise<{ ok: true; urls: string[] } | { ok: false; error: string }> {
  try {
    if (!hasImageKey()) return { ok: false, error: "no_key" };
    if (!prompt?.trim()) return { ok: false, error: "empty" };
    const c = await ctxOrNull();
    if (!c) return { ok: false, error: "no_session" };
    const t = forOrg(c.db, c.ctx.orgId);
    if ((await t.balance()) < estimateImage()) return { ok: false, error: "insufficient_credits" };
    const urls = await generateImages(prompt.trim(), { aspectRatio: aspect, n });
    if (!urls.length) return { ok: false, error: "failed" };
    await t.debit(estimateImage(), "image_gen", "brand", c.ctx.brandId);
    return { ok: true, urls };
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

/** Poll a video task; returns its status and a URL once ready. */
export async function pollVideo(taskId: string): Promise<{ status: string; url?: string }> {
  try {
    const s = await queryVideo(taskId);
    if (s.status === "success" && s.fileId) {
      const url = await retrieveVideoUrl(s.fileId);
      return { status: "success", url: url ?? undefined };
    }
    return { status: s.status };
  } catch {
    return { status: "fail" };
  }
}
