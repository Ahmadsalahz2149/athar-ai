"use client";

import { useMemo, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { GlyphIcon, btnNavy, btnTeal, btnGhost } from "@/components/ui/display";
import { groupSearchUrl, GROUP_PLATFORMS, type DistributionKit } from "@/lib/distribution/types";
import { generateAudience, saveGroup, deleteGroup, markGroupPosted } from "./actions";

export type GroupView = {
  id: string;
  platform: string;
  name: string;
  url: string | null;
  memberCount: number | null;
  rules: string | null;
  status: string;
  cadenceDays: number;
  notes: string | null;
  lastPostedAt: string | null;
};
export type ReadyPost = { id: string; platform: string; hook: string; body: string; status: string };

const cardStyle: CSSProperties = { background: "var(--surface,#fff)", border: "1px solid var(--border)", borderRadius: 16, padding: "clamp(16px,2.4vw,22px)", marginBlockEnd: 16 };
const label: CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "var(--heading)", marginBlockEnd: 6, display: "block" };
const input: CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg,#fff)", fontSize: 14, color: "var(--heading)", fontFamily: "inherit" };

const PLATFORM_LABEL: Record<string, string> = { facebook: "Facebook", linkedin: "LinkedIn", telegram: "Telegram", reddit: "Reddit", whatsapp: "WhatsApp" };
const PLATFORM_COLOR: Record<string, string> = { facebook: "#1877F2", linkedin: "#0A66C2", telegram: "#229ED9", reddit: "#FF4500", whatsapp: "#25D366" };

function Section({ glyph, title, desc, children, action }: { glyph: string; title: string; desc?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section style={cardStyle} className="lift">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBlockEnd: 14 }}>
        <span style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, background: "var(--teal-tint,#e6f7f4)", color: "var(--teal)", flexShrink: 0 }}>
          <GlyphIcon name={glyph} size={20} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--heading)" }}>{title}</div>
          {desc && <div style={{ fontSize: 12.8, color: "var(--muted)", marginBlockStart: 2 }}>{desc}</div>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PlatformTag({ platform }: { platform: string }) {
  const c = PLATFORM_COLOR[platform] ?? "var(--slate-2)";
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: `${c}1a`, color: c }}>{PLATFORM_LABEL[platform] ?? platform}</span>;
}

export function DistributeClient({ kit, groups, posts, hasDna, locale }: { kit: DistributionKit; groups: GroupView[]; posts: ReadyPost[]; hasDna: boolean; locale: string }) {
  const t = useTranslations("Distribute");
  const router = useRouter();

  return (
    <div>
      {/* Compliance note — this is why the approach is safe. */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 12, background: "var(--teal-tint,#e6f7f4)", border: "1px solid var(--teal)", marginBlockEnd: 16 }}>
        <span style={{ color: "var(--teal)", flexShrink: 0, marginBlockStart: 1 }}><GlyphIcon name="target" size={18} /></span>
        <div style={{ fontSize: 12.8, color: "var(--teal-deep,#0f766e)", lineHeight: 1.7 }}>{t("safeNote")}</div>
      </div>

      <AudienceSection kit={kit} hasDna={hasDna} t={t} router={router} />
      <GroupsSection groups={groups} t={t} router={router} locale={locale} />
      <AssistedSection posts={posts} groups={groups} t={t} router={router} />
    </div>
  );
}

/* ---------- Audience + keywords ---------- */
function AudienceSection({ kit, hasDna, t, router }: { kit: DistributionKit; hasDna: boolean; t: ReturnType<typeof useTranslations>; router: ReturnType<typeof useRouter> }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const a = kit.audience;
  const hasKit = !!a.summary || kit.keywords.length > 0;

  const generate = () =>
    start(async () => {
      setErr("");
      const r = await generateAudience();
      if (!r.ok) setErr(r.error === "no_dna" ? t("errNoDna") : r.error === "insufficient_credits" ? t("errCredits") : r.error === "no_key" ? t("errNoKey") : t("errGeneric"));
      else router.refresh();
    });

  return (
    <Section
      glyph="target"
      title={t("audienceTitle")}
      desc={t("audienceDesc")}
      action={<button onClick={generate} disabled={pending || !hasDna} style={{ ...btnTeal, height: 36, fontSize: 12.5, whiteSpace: "nowrap" }}>{pending ? t("analyzing") : hasKit ? t("regenerate") : t("analyze")}</button>}
    >
      {!hasDna && <div style={{ fontSize: 12.8, color: "var(--gold-dark)" }}>{t("needDna")}</div>}
      {err && <div style={{ fontSize: 12.8, color: "var(--danger,#dc2626)", marginBlockEnd: 10 }}>{err}</div>}
      {hasDna && !hasKit && !err && <div style={{ fontSize: 12.8, color: "var(--muted)" }}>{t("audienceEmpty")}</div>}

      {hasKit && (
        <div style={{ display: "grid", gap: 16 }}>
          {a.summary && <p style={{ fontSize: 14, color: "var(--heading)", lineHeight: 1.8, margin: 0 }}>{a.summary}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 12 }}>
            <ChipGroup title={t("segments")} items={a.segments} tint="var(--blue-tint)" fg="var(--blue)" />
            <ChipGroup title={t("interests")} items={a.interests} tint="var(--teal-tint,#e6f7f4)" fg="var(--teal-deep,#0f766e)" />
            <ChipGroup title={t("painPoints")} items={a.painPoints} tint="var(--coral-tint)" fg="var(--coral)" />
            <ChipGroup title={t("wateringHoles")} items={a.wateringHoles} tint="var(--gold-tint)" fg="var(--gold-dark)" />
          </div>
          {a.demographics && <div style={{ fontSize: 12.8, color: "var(--muted)" }}><b style={{ color: "var(--heading)" }}>{t("demographics")}:</b> {a.demographics}</div>}

          {/* Keywords → clickable group searches */}
          {kit.keywords.length > 0 && (
            <div>
              <div style={label}>{t("keywords")}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {kit.keywords.map((k, i) => (
                  <a key={i} href={groupSearchUrl("facebook", k)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "var(--surface,#fff)", border: "1px solid var(--border)", fontSize: 12.8, fontWeight: 600, color: "var(--heading)", textDecoration: "none" }}>
                    {k}
                    <span style={{ color: "var(--teal)", fontSize: 11 }}>↗</span>
                  </a>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--subtle)", marginBlockStart: 6 }}>{t("keywordsHint")}</div>
            </div>
          )}

          {/* Platform-specific ready queries */}
          {kit.queries.length > 0 && (
            <div>
              <div style={label}>{t("queries")}</div>
              <div style={{ display: "grid", gap: 6 }}>
                {kit.queries.map((q, i) => (
                  <a key={i} href={groupSearchUrl(q.platform, q.query)} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", textDecoration: "none", color: "var(--heading)" }}>
                    <PlatformTag platform={q.platform} />
                    <span style={{ flex: 1, fontSize: 13.5 }}>{q.query}</span>
                    <span style={{ color: "var(--teal)", fontSize: 13 }}>{t("openSearch")} ↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

function ChipGroup({ title, items, tint, fg }: { title: string; items: string[]; tint: string; fg: string }) {
  if (!items.length) return null;
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBlockEnd: 6, textTransform: "uppercase", letterSpacing: ".3px" }}>{title}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {items.map((it, i) => (
          <span key={i} style={{ padding: "4px 10px", borderRadius: 999, background: tint, color: fg, fontSize: 12, fontWeight: 600 }}>{it}</span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Groups sheet ---------- */
type GDraft = { id?: string; platform: string; name: string; url: string; memberCount: string; cadenceDays: string; rules: string; status: string };
const EMPTY_G: GDraft = { platform: "facebook", name: "", url: "", memberCount: "", cadenceDays: "3", rules: "", status: "prospect" };

function GroupsSection({ groups, t, router, locale }: { groups: GroupView[]; t: ReturnType<typeof useTranslations>; router: ReturnType<typeof useRouter>; locale: string }) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<GDraft | null>(null);
  const nf = useMemo(() => new Intl.NumberFormat(locale === "ar" ? "ar" : "en"), [locale]);

  const edit = (g: GroupView) => setDraft({ id: g.id, platform: g.platform, name: g.name, url: g.url ?? "", memberCount: g.memberCount != null ? String(g.memberCount) : "", cadenceDays: String(g.cadenceDays), rules: g.rules ?? "", status: g.status });
  const save = () =>
    draft &&
    start(async () => {
      const r = await saveGroup({ id: draft.id, platform: draft.platform, name: draft.name, url: draft.url || null, memberCount: draft.memberCount ? Number(draft.memberCount) : null, cadenceDays: draft.cadenceDays ? Number(draft.cadenceDays) : 3, rules: draft.rules || null, status: draft.status });
      if (r.ok) { setDraft(null); router.refresh(); }
    });
  const remove = (id: string) => start(async () => { await deleteGroup(id); router.refresh(); });

  const statusTone: Record<string, { bg: string; fg: string }> = {
    prospect: { bg: "var(--gold-tint)", fg: "var(--gold-dark)" },
    active: { bg: "var(--teal-tint,#e6f7f4)", fg: "var(--teal-deep,#0f766e)" },
    paused: { bg: "var(--border-3,#eef1f5)", fg: "var(--slate-2)" },
    blocked: { bg: "var(--coral-tint)", fg: "var(--coral)" },
  };

  return (
    <Section
      glyph="briefcase"
      title={t("groupsTitle")}
      desc={t("groupsDesc")}
      action={!draft ? <button onClick={() => setDraft({ ...EMPTY_G })} style={{ ...btnGhost, height: 34, fontSize: 12.5 }}>+ {t("addGroup")}</button> : null}
    >
      {draft && (
        <div style={{ border: "1px solid var(--teal)", borderRadius: 12, padding: 14, marginBlockEnd: 14, background: "var(--teal-tint,#e6f7f4)" }}>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {GROUP_PLATFORMS.map((pf) => (
                <button key={pf} onClick={() => setDraft({ ...draft, platform: pf })} style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${draft.platform === pf ? "var(--teal)" : "var(--border)"}`, background: draft.platform === pf ? "var(--teal)" : "#fff", color: draft.platform === pf ? "#fff" : "var(--heading)" }}>
                  {PLATFORM_LABEL[pf]}
                </button>
              ))}
            </div>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t("groupNamePh")} style={input} />
            <input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder={t("groupUrlPh")} style={input} dir="ltr" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input value={draft.memberCount} onChange={(e) => setDraft({ ...draft, memberCount: e.target.value.replace(/[^\d]/g, "") })} placeholder={t("membersPh")} style={input} inputMode="numeric" />
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--heading)" }}>
                {t("cadenceLabel")}
                <input value={draft.cadenceDays} onChange={(e) => setDraft({ ...draft, cadenceDays: e.target.value.replace(/[^\d]/g, "") })} style={{ ...input, width: 70 }} inputMode="numeric" />
              </label>
            </div>
            <textarea value={draft.rules} onChange={(e) => setDraft({ ...draft, rules: e.target.value })} placeholder={t("rulesPh")} rows={2} style={{ ...input, resize: "vertical" }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDraft(null)} style={{ ...btnGhost, height: 38 }}>{t("cancel")}</button>
              <button onClick={save} disabled={pending || !draft.name.trim()} style={{ ...btnTeal, height: 38 }}>{pending ? t("saving") : t("save")}</button>
            </div>
          </div>
        </div>
      )}

      {groups.length === 0 && !draft && <div style={{ fontSize: 12.8, color: "var(--muted)" }}>{t("groupsEmpty")}</div>}
      <div style={{ display: "grid", gap: 8 }}>
        {groups.map((g) => {
          const tone = statusTone[g.status] ?? statusTone.prospect;
          return (
            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 12, border: "1px solid var(--border)", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <PlatformTag platform={g.platform} />
                  {g.url ? (
                    <a href={g.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, fontSize: 14, color: "var(--heading)", textDecoration: "none" }}>{g.name} ↗</a>
                  ) : (
                    <span style={{ fontWeight: 600, fontSize: 14, color: "var(--heading)" }}>{g.name}</span>
                  )}
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: tone.bg, color: tone.fg }}>{t(`status_${g.status}`)}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginBlockStart: 3 }}>
                  {g.memberCount != null && <span>{t("membersN", { n: nf.format(g.memberCount) })} · </span>}
                  <span>{t("cadenceEveryN", { n: nf.format(g.cadenceDays) })}</span>
                  {g.lastPostedAt && <span> · {t("lastPosted", { when: relDays(g.lastPostedAt, locale) })}</span>}
                </div>
              </div>
              <button onClick={() => edit(g)} style={{ ...btnGhost, height: 32, fontSize: 12 }}>{t("editBtn")}</button>
              <button onClick={() => remove(g.id)} disabled={pending} style={{ ...btnGhost, height: 32, fontSize: 12, color: "var(--danger,#dc2626)" }}>{t("delete")}</button>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ---------- Assisted posting ---------- */
function AssistedSection({ posts, groups, t, router }: { posts: ReadyPost[]; groups: GroupView[]; t: ReturnType<typeof useTranslations>; router: ReturnType<typeof useRouter> }) {
  const [pending, start] = useTransition();
  const [postId, setPostId] = useState<string>(posts[0]?.id ?? "");
  const [copied, setCopied] = useState<string>("");
  const post = posts.find((p) => p.id === postId);
  const text = post ? [post.hook, post.body].filter(Boolean).join("\n\n") : "";
  const activeGroups = groups.filter((g) => g.status !== "blocked");

  const copyOpen = (g: GroupView) => {
    if (text) navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(g.id);
    setTimeout(() => setCopied(""), 2500);
    if (g.url) window.open(g.url, "_blank", "noopener,noreferrer");
  };
  const posted = (id: string) => start(async () => { await markGroupPosted(id); router.refresh(); });

  return (
    <Section glyph="message" title={t("assistTitle")} desc={t("assistDesc")}>
      {posts.length === 0 ? (
        <div style={{ fontSize: 12.8, color: "var(--muted)" }}>{t("noPosts")}</div>
      ) : activeGroups.length === 0 ? (
        <div style={{ fontSize: 12.8, color: "var(--muted)" }}>{t("noActiveGroups")}</div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={label}>{t("choosePost")}</label>
            <select value={postId} onChange={(e) => setPostId(e.target.value)} style={{ ...input, cursor: "pointer" }}>
              {posts.map((p) => (
                <option key={p.id} value={p.id}>{(p.hook || p.body).slice(0, 70)}</option>
              ))}
            </select>
          </div>
          {text && (
            <div style={{ padding: 12, borderRadius: 10, background: "var(--bg,#f8fafc)", border: "1px solid var(--border)", fontSize: 13, color: "var(--heading)", whiteSpace: "pre-wrap", maxHeight: 160, overflowY: "auto", lineHeight: 1.7 }}>{text}</div>
          )}
          <div style={{ display: "grid", gap: 8 }}>
            {activeGroups.map((g) => {
              const due = isDue(g.lastPostedAt, g.cadenceDays);
              return (
                <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", flexWrap: "wrap" }}>
                  <PlatformTag platform={g.platform} />
                  <span style={{ flex: 1, minWidth: 120, fontSize: 13.5, fontWeight: 600, color: "var(--heading)" }}>{g.name}</span>
                  {!due && <span style={{ fontSize: 11, color: "var(--gold-dark)", fontWeight: 600 }}>{t("notDueYet")}</span>}
                  <button onClick={() => copyOpen(g)} style={{ ...btnNavy, height: 32, fontSize: 12 }}>{copied === g.id ? t("copied") : t("copyOpen")}</button>
                  <button onClick={() => posted(g.id)} disabled={pending} style={{ ...btnGhost, height: 32, fontSize: 12 }}>{t("markPosted")}</button>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--subtle)", lineHeight: 1.7 }}>{t("assistHint")}</div>
        </div>
      )}
    </Section>
  );
}

function relDays(iso: string, locale: string): string {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar" : "en", { numeric: "auto" });
  return rtf.format(-days, "day");
}
function isDue(lastPostedAt: string | null, cadenceDays: number): boolean {
  if (!lastPostedAt) return true;
  return Date.now() - new Date(lastPostedAt).getTime() >= cadenceDays * 86400000;
}
