import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { hasTtsKey } from "@/lib/ai/tts";
import { hasImageKey } from "@/lib/ai/image";
import { hasVideoKey } from "@/lib/ai/video";
import { MediaClient, type RecentDraft } from "./MediaClient";

export const dynamic = "force-dynamic";
// Voice/image generation can take a while — give the server actions room.
export const maxDuration = 60;

export default async function MediaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Media");

  let drafts: RecentDraft[] = [];
  if (db) {
    const ctx = await currentContext();
    if (ctx) {
      const rows = await forOrg(db, ctx.orgId).listDrafts(ctx.brandId, 15);
      drafts = rows
        .filter((d) => d.hook || d.body)
        .map((d) => ({ id: d.id, label: (d.topic || d.hook || "").slice(0, 60), text: [d.hook, d.body].filter(Boolean).join("\n\n") }));
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px", animation: "floatUp .4s ease" }}>
      <h1 className="headline-gradient" style={{ fontSize: "clamp(21px,3.2vw,27px)", fontWeight: 700, letterSpacing: "-.4px" }}>{t("title")}</h1>
      <p style={{ fontSize: 14.5, color: "var(--muted)", marginBlock: "6px 20px", maxWidth: 680 }}>{t("subtitle")}</p>
      <MediaClient drafts={drafts} keys={{ voice: hasTtsKey(), image: hasImageKey(), video: hasVideoKey() }} />
    </main>
  );
}
