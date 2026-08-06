import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { hasTtsKey } from "@/lib/ai/tts";
import { hasImageKey } from "@/lib/ai/image";
import { hasVideoKey } from "@/lib/ai/video";
import { MediaClient, type RecentDraft, type MediaAsset } from "./MediaClient";

export const dynamic = "force-dynamic";
// Voice/image generation can take a while — give the server actions room.
export const maxDuration = 60;

export default async function MediaPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ draft?: string; kind?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Media");

  let drafts: RecentDraft[] = [];
  let assets: MediaAsset[] = [];
  let preset: { text: string; label: string } | null = null;
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const org = forOrg(db, ctx.orgId);
      const [rows, ma] = await Promise.all([org.listDrafts(ctx.brandId, 15), org.listMediaAssets(ctx.brandId)]);
      drafts = rows
        .filter((d) => d.hook || d.body)
        .map((d) => ({ id: d.id, label: (d.topic || d.hook || "").slice(0, 60), text: [d.hook, d.body].filter(Boolean).join("\n\n") }));
      assets = ma.map((a) => ({ id: a.id, kind: a.kind, url: a.url, prompt: a.prompt, createdAt: a.createdAt.toISOString() }));
      // Deep-linked from a post ("create media for this post").
      if (sp.draft) preset = await org.draftText(ctx.brandId, sp.draft);
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      <h1 className="headline-gradient" style={{ fontSize: "clamp(21px,3.2vw,27px)", fontWeight: 700, letterSpacing: "-.4px" }}>{t("title")}</h1>
      <p style={{ fontSize: 14.5, color: "var(--muted)", marginBlock: "6px 20px", maxWidth: 680 }}>{t("subtitle")}</p>
      <MediaClient
        drafts={drafts}
        assets={assets}
        keys={{ voice: hasTtsKey(), image: hasImageKey(), video: hasVideoKey() }}
        presetText={preset?.text ?? ""}
        presetDraftId={sp.draft ?? ""}
        presetTab={sp.kind === "image" || sp.kind === "video" ? sp.kind : "voice"}
        locale={locale}
      />
    </main>
  );
}
