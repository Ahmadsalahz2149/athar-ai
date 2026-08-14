"use client";
/* eslint-disable @next/next/no-img-element -- generated/external media, not next/image-optimizable */

import { useMemo, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { btnTeal, btnGhost } from "@/components/ui/display";
import { generateVoice, generateImage, suggestImagePrompt, startVideo, pollVideo, deleteAsset } from "./actions";

export type RecentDraft = { id: string; label: string; text: string };
export type MediaAsset = { id: string; kind: string; url: string; prompt: string | null; createdAt: string };
type Tab = "voice" | "image" | "video";
type Tr = ReturnType<typeof useTranslations>;

const input: CSSProperties = { width: "100%", padding: "11px 13px", borderRadius: 11, border: "1px solid var(--border)", background: "var(--bg,#fff)", fontSize: 14, color: "var(--heading)", fontFamily: "inherit", outline: "none" };
const label: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBlockEnd: 7, display: "block" };

// Consistent Lucide-style line icons (no emoji, per the design system).
const ICON: Record<string, string> = {
  image: "M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 15l4-4 3 3 4-5 5 6",
  video: "M4 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM16 10l4-2v8l-4-2",
  mic: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 21a7 7 0 0 1 14 0",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 0 2 2h13",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  camera: "M4 8a2 2 0 0 1 2-2h1l1-2h6l1 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  box: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v9",
  layers: "M12 2 21 7l-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5",
  brush: "M9.5 14.5 4 20a2 2 0 0 0 3 3l5.5-5.5M14 4l6 6-8 8-6-6z",
  square: "M5 5h14v14H5z",
  film: "M4 4h16v16H4zM4 8.5h16M4 15.5h16M8 4v16M16 4v16",
  megaphone: "M3 11v2a1 1 0 0 0 1 1h1.5L10 18V6L5.5 10H4a1 1 0 0 0-1 1zM14 8a4 4 0 0 1 0 8",
  landscape: "M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 16l4-4 4 4 3-3 5 5",
  zoomIn: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M8 11h6M11 8v6",
  bag: "M6 2 3 6v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0",
  phone: "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4 4.2 19.8M19.8 4.2l-1.4 1.4",
};
function Ic({ name, size = 18 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICON[name] ?? ICON.image} /></svg>;
}

const VOICES = [
  { id: "male-qn-jingying", ar: "رجل واثق", ic: "user" }, { id: "male-qn-qingse", ar: "شاب", ic: "user" },
  { id: "female-yujie", ar: "امرأة راقية", ic: "user" }, { id: "female-shaonv", ar: "شابة", ic: "user" },
  { id: "presenter_male", ar: "مذيع", ic: "mic" }, { id: "audiobook_male_1", ar: "راوٍ", ic: "book" },
];
const ASPECTS: { v: "1:1" | "16:9" | "9:16" | "4:3" | "3:4"; w: number; h: number }[] = [
  { v: "1:1", w: 20, h: 20 }, { v: "16:9", w: 26, h: 15 }, { v: "9:16", w: 15, h: 26 }, { v: "4:3", w: 24, h: 18 }, { v: "3:4", w: 18, h: 24 },
];
// Style presets append proven English keywords to the prompt (image models are
// trained on English); labels stay Arabic. "auto" adds nothing.
const IMAGE_STYLES = [
  { k: "auto", kw: "", ic: "bolt" }, { k: "photo", kw: "photorealistic, natural lighting, high detail, 4k", ic: "camera" },
  { k: "product", kw: "professional product photography, studio lighting, clean seamless background, commercial", ic: "box" },
  { k: "render3d", kw: "3D render, octane, soft studio lighting, glossy, subtle reflections", ic: "layers" },
  { k: "illustration", kw: "flat vector illustration, bold colors, modern, clean shapes", ic: "brush" },
  { k: "minimal", kw: "minimalist, generous negative space, muted elegant palette", ic: "square" },
  { k: "cinematic", kw: "cinematic, dramatic lighting, shallow depth of field, film still", ic: "film" },
  { k: "social", kw: "eye-catching social media graphic, vibrant, marketing poster, space for text", ic: "megaphone" },
];
const VIDEO_SCENES = [
  { k: "auto", kw: "", ic: "bolt" }, { k: "wide", kw: "wide establishing shot, smooth slow camera move", ic: "landscape" },
  { k: "closeup", kw: "close-up shot, shallow depth of field, crisp focus", ic: "zoomIn" },
  { k: "showcase", kw: "product showcase, slowly rotating on a pedestal, studio lighting", ic: "bag" },
  { k: "ugc", kw: "handheld UGC style, a person holding and presenting the product to camera, authentic", ic: "phone" },
  { k: "cinematic", kw: "cinematic slow pan, dramatic lighting, subtle film grain", ic: "film" },
  { k: "lifestyle", kw: "lifestyle scene, natural warm setting, everyday moment", ic: "sun" },
];
const MODEL_LABEL: Record<Tab, string> = { image: "MiniMax Image", video: "MiniMax Video · Hailuo", voice: "MiniMax Voice" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const compose = (prompt: string, kw: string) => [prompt.trim(), kw].filter(Boolean).join(", ");

function errMsg(error: string, t: Tr): string {
  return error === "no_key" ? t("errNoKey") : error === "insufficient_credits" ? t("errCredits") : error === "needs_credits" ? t("errVideoCredits") : error === "empty" ? t("errEmpty") : t("errGeneric");
}

/* ---------- shared bits ---------- */
function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background: "var(--surface,#fff)", border: "1px solid var(--border)", borderRadius: 12, padding: "clamp(16px,2.2vw,20px)", ...style }}>{children}</div>;
}
function DraftPicker({ drafts, onPick, t }: { drafts: RecentDraft[]; onPick: (d: RecentDraft) => void; t: Tr }) {
  if (!drafts.length) return null;
  return (
    <div style={{ marginBlockEnd: 14 }}>
      <label style={label}>{t("fromPost")}</label>
      <select onChange={(e) => { const d = drafts.find((x) => x.id === e.target.value); if (d) onPick(d); }} style={{ ...input, cursor: "pointer" }} defaultValue="">
        <option value="" disabled>{t("choosePost")}</option>
        {drafts.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
      </select>
    </div>
  );
}
function ModelPill({ tab }: { tab: Tab }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "var(--teal-tint)", border: "1px solid color-mix(in srgb,var(--teal) 25%, var(--border))", marginBlockEnd: 14 }}>
      <span style={{ width: 22, height: 22, borderRadius: 6, display: "grid", placeItems: "center", background: "var(--teal)", color: "#fff" }}><Ic name="bolt" size={13} /></span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--teal-deep)", fontFamily: "var(--font-latin)" }}>{MODEL_LABEL[tab]}</span>
    </div>
  );
}
function PresetGrid({ items, active, onPick, t }: { items: { k: string; ic: string }[]; active: string; onPick: (k: string) => void; t: Tr }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))", gap: 8 }}>
      {items.map((it) => {
        const on = active === it.k;
        return (
          <button key={it.k} onClick={() => onPick(it.k)} className="lift" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", borderRadius: 10, cursor: "pointer", border: `1px solid ${on ? "var(--teal)" : "var(--border)"}`, background: on ? "var(--teal-tint)" : "var(--card,#fff)", textAlign: "center", color: on ? "var(--teal-deep)" : "var(--muted)" }}>
            <Ic name={it.ic} size={20} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: on ? "var(--teal-deep)" : "var(--heading)", lineHeight: 1.3 }}>{t(`preset_${it.k}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
function ErrLine({ msg }: { msg: string }) {
  return <div style={{ marginBlockStart: 10, fontSize: 13, color: "var(--coral,#dc2626)" }}>{msg}</div>;
}
function KeyNote({ t }: { t: Tr }) {
  return <Panel style={{ fontSize: 13.5, color: "var(--gold-dark)" }}>{t("needKey")}</Panel>;
}
function StudioLayout({ form, presets, presetsTitle }: { form: ReactNode; presets: ReactNode; presetsTitle: string }) {
  return (
    <div className="media-studio">
      <Panel>{form}</Panel>
      <Panel>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--heading)", marginBlockEnd: 14 }}>{presetsTitle}</div>
        {presets}
      </Panel>
    </div>
  );
}

export function MediaClient({ drafts, assets, keys, presetText, presetDraftId, presetTab, locale }: {
  drafts: RecentDraft[]; assets: MediaAsset[]; keys: { voice: boolean; image: boolean; video: boolean };
  presetText: string; presetDraftId: string; presetTab: Tab; locale: string;
}) {
  const t = useTranslations("Media");
  const [tab, setTab] = useState<Tab>(presetTab);
  const [filter, setFilter] = useState<"all" | Tab>("all");
  const tabs: { k: Tab; ic: string }[] = [{ k: "image", ic: "image" }, { k: "video", ic: "video" }, { k: "voice", ic: "mic" }];

  return (
    <div>
      {/* Segmented tab bar */}
      <div style={{ display: "inline-flex", gap: 4, padding: 5, background: "var(--surface,#fff)", border: "1px solid var(--border)", borderRadius: 14, marginBlockEnd: 18, flexWrap: "wrap" }}>
        {tabs.map((x) => (
          <button key={x.k} onClick={() => setTab(x.k)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", border: "none", background: tab === x.k ? "var(--teal)" : "transparent", color: tab === x.k ? "#fff" : "var(--muted)" }}>
            <Ic name={x.ic} size={16} /> {t(`tab_${x.k}`)}
          </button>
        ))}
      </div>

      {tab === "voice" && (keys.voice ? <VoiceTab drafts={drafts} presetText={presetText} presetDraftId={presetDraftId} t={t} /> : <KeyNote t={t} />)}
      {tab === "image" && (keys.image ? <ImageTab drafts={drafts} presetText={presetText} presetDraftId={presetDraftId} t={t} /> : <KeyNote t={t} />)}
      {tab === "video" && (keys.video ? <VideoTab drafts={drafts} presetText={presetText} presetDraftId={presetDraftId} t={t} /> : <KeyNote t={t} />)}

      <Gallery assets={assets} t={t} locale={locale} filter={filter} setFilter={setFilter} />
    </div>
  );
}

/* ---------- Image ---------- */
function ImageTab({ drafts, presetText, presetDraftId, t }: { drafts: RecentDraft[]; presetText: string; presetDraftId: string; t: Tr }) {
  const [postText, setPostText] = useState(presetText);
  const [draftId, setDraftId] = useState(presetDraftId);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("auto");
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]["v"]>("1:1");
  const [pending, start] = useTransition();
  const [suggesting, startSuggest] = useTransition();
  const [urls, setUrls] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const router = useRouter();

  const suggest = () => startSuggest(async () => { setErr(""); const r = await suggestImagePrompt(postText); if (r.ok) setPrompt(r.prompt); else setErr(errMsg(r.error, t)); });
  const go = () => start(async () => {
    setErr(""); setUrls([]);
    const kw = IMAGE_STYLES.find((s) => s.k === style)?.kw ?? "";
    const r = await generateImage(compose(prompt, kw), aspect, 2, draftId || undefined);
    if (r.ok) { setUrls(r.urls); router.refresh(); } else setErr(errMsg(r.error, t));
  });

  return (
    <StudioLayout
      presetsTitle={t("stylePresets")}
      presets={<PresetGrid items={IMAGE_STYLES} active={style} onPick={setStyle} t={t} />}
      form={
        <>
          <ModelPill tab="image" />
          <DraftPicker drafts={drafts} onPick={(d) => { setPostText(d.text); setDraftId(d.id); }} t={t} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <label style={{ ...label, marginBlockEnd: 0 }}>{t("imagePrompt")}</label>
            {postText && <button onClick={suggest} disabled={suggesting} style={{ ...btnGhost, height: 30, fontSize: 12, padding: "0 10px" }}>{suggesting ? t("suggesting") : t("suggestVisual")}</button>}
          </div>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t("imagePh")} rows={3} dir="ltr" style={{ ...input, resize: "vertical", textAlign: "start", marginBlockStart: 7 }} />

          <label style={{ ...label, marginBlockStart: 14 }}>{t("aspect")}</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ASPECTS.map((a) => {
              const on = aspect === a.v;
              return (
                <button key={a.v} onClick={() => setAspect(a.v)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 10, cursor: "pointer", border: `1.5px solid ${on ? "var(--teal)" : "var(--border)"}`, background: on ? "var(--teal-tint,#e6f2f0)" : "transparent" }}>
                  <span style={{ display: "block", width: a.w, height: a.h, borderRadius: 3, background: on ? "var(--teal)" : "var(--border-2,#d1d5db)" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-latin)", color: on ? "var(--teal-deep)" : "var(--muted)" }}>{a.v}</span>
                </button>
              );
            })}
          </div>

          <button onClick={go} disabled={pending || !prompt.trim()} style={{ ...btnTeal, height: 46, width: "100%", marginBlockStart: 18, fontSize: 14.5 }}>{pending ? t("generating") : t("genImage")}</button>

          {urls.length > 0 && (
            <>
              <div style={{ marginBlockStart: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))", gap: 10 }}>
                {urls.map((u, i) => <img key={i} src={u} alt="" style={{ width: "100%", borderRadius: 12, display: "block", border: "1px solid var(--border)" }} />)}
              </div>
              <span style={{ display: "block", marginBlockStart: 8, fontSize: 12, color: "var(--teal-deep)", fontWeight: 600 }}>{t("savedToGallery")}</span>
            </>
          )}
          {err && <ErrLine msg={err} />}
        </>
      }
    />
  );
}

/* ---------- Video ---------- */
function VideoTab({ drafts, presetText, presetDraftId, t }: { drafts: RecentDraft[]; presetText: string; presetDraftId: string; t: Tr }) {
  const [postText, setPostText] = useState(presetText);
  const [draftId, setDraftId] = useState(presetDraftId);
  const [prompt, setPrompt] = useState("");
  const [scene, setScene] = useState("auto");
  const [pending, start] = useTransition();
  const [suggesting, startSuggest] = useTransition();
  const [status, setStatus] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const router = useRouter();

  const suggest = () => startSuggest(async () => { setErr(""); const r = await suggestImagePrompt(postText); if (r.ok) setPrompt(r.prompt); else setErr(errMsg(r.error, t)); });
  const go = () => start(async () => {
    setErr(""); setUrl(null); setStatus(t("videoQueued"));
    const kw = VIDEO_SCENES.find((s) => s.k === scene)?.kw ?? "";
    const r = await startVideo(compose(prompt, kw));
    if (!r.ok) { setStatus(""); setErr(errMsg(r.error, t)); return; }
    for (let i = 0; i < 60; i++) {
      await sleep(5000);
      const s = await pollVideo(r.taskId, prompt, draftId || undefined);
      if (s.status === "success" && s.url) { setUrl(s.url); setStatus(""); router.refresh(); return; }
      if (s.status === "fail") { setStatus(""); setErr(t("errGeneric")); return; }
      setStatus(t("videoProcessing"));
    }
    setStatus(""); setErr(t("errTimeout"));
  });

  return (
    <StudioLayout
      presetsTitle={t("scenePresets")}
      presets={<PresetGrid items={VIDEO_SCENES} active={scene} onPick={setScene} t={t} />}
      form={
        <>
          <ModelPill tab="video" />
          <DraftPicker drafts={drafts} onPick={(d) => { setPostText(d.text); setDraftId(d.id); }} t={t} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <label style={{ ...label, marginBlockEnd: 0 }}>{t("videoPrompt")}</label>
            {postText && <button onClick={suggest} disabled={suggesting} style={{ ...btnGhost, height: 30, fontSize: 12, padding: "0 10px" }}>{suggesting ? t("suggesting") : t("suggestVisual")}</button>}
          </div>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t("videoPh")} rows={3} dir="ltr" style={{ ...input, resize: "vertical", textAlign: "start", marginBlockStart: 7 }} />
          <button onClick={go} disabled={pending || !prompt.trim()} style={{ ...btnTeal, height: 46, width: "100%", marginBlockStart: 16, fontSize: 14.5 }}>{pending ? t("generating") : t("genVideo")}</button>
          {status && <div style={{ marginBlockStart: 14, fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}><span className="skeleton" style={{ width: 14, height: 14, borderRadius: "50%" }} />{status}</div>}
          {url && <div style={{ marginBlockStart: 14, display: "grid", gap: 8 }}><video controls src={url} style={{ width: "100%", borderRadius: 12 }} /><span style={{ fontSize: 12, color: "var(--teal-deep)", fontWeight: 600 }}>{t("savedToGallery")}</span></div>}
          {err && <ErrLine msg={err} />}
        </>
      }
    />
  );
}

/* ---------- Voice ---------- */
function VoiceTab({ drafts, presetText, presetDraftId, t }: { drafts: RecentDraft[]; presetText: string; presetDraftId: string; t: Tr }) {
  const [text, setText] = useState(presetText);
  const [draftId, setDraftId] = useState(presetDraftId);
  const [voice, setVoice] = useState(VOICES[0].id);
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const router = useRouter();

  const go = () => start(async () => {
    setErr(""); setUrl(null);
    const r = await generateVoice(text, voice, draftId || undefined);
    if (r.ok) { setUrl(r.url); router.refresh(); } else setErr(errMsg(r.error, t));
  });

  return (
    <StudioLayout
      presetsTitle={t("voicePresets")}
      presets={
        <div style={{ display: "grid", gap: 8 }}>
          {VOICES.map((v) => {
            const on = voice === v.id;
            return (
              <button key={v.id} onClick={() => setVoice(v.id)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 12, cursor: "pointer", border: `1.5px solid ${on ? "var(--teal)" : "var(--border)"}`, background: on ? "var(--teal-tint,#e6f2f0)" : "var(--card,#fff)", textAlign: "start" }}>
                <span style={{ color: on ? "var(--teal-deep)" : "var(--muted)", display: "grid", placeItems: "center", flexShrink: 0 }}><Ic name={v.ic} size={18} /></span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: on ? "var(--teal-deep)" : "var(--heading)" }}>{v.ar}</span>
                {on && <span style={{ color: "var(--teal)", fontSize: 15 }}>✓</span>}
              </button>
            );
          })}
        </div>
      }
      form={
        <>
          <ModelPill tab="voice" />
          <DraftPicker drafts={drafts} onPick={(d) => { setText(d.text); setDraftId(d.id); }} t={t} />
          <label style={label}>{t("voiceText")}</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("voicePh")} rows={5} style={{ ...input, resize: "vertical" }} />
          <button onClick={go} disabled={pending || !text.trim()} style={{ ...btnTeal, height: 46, width: "100%", marginBlockStart: 16, fontSize: 14.5 }}>{pending ? t("generating") : t("genVoice")}</button>
          {url && <div style={{ marginBlockStart: 14, display: "grid", gap: 8 }}><audio controls src={url} style={{ width: "100%" }} /><span style={{ fontSize: 12, color: "var(--teal-deep)", fontWeight: 600 }}>{t("savedToGallery")}</span></div>}
          {err && <ErrLine msg={err} />}
        </>
      }
    />
  );
}

/* ---------- Persistent gallery ---------- */
function Gallery({ assets, t, locale, filter, setFilter }: { assets: MediaAsset[]; t: Tr; locale: string; filter: "all" | Tab; setFilter: (f: "all" | Tab) => void }) {
  const [items, setItems] = useState(assets);
  const [, start] = useTransition();
  const df = useMemo(() => new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { month: "short", day: "numeric" }), [locale]);
  if (!items.length) return null;
  const remove = (id: string) => { setItems((x) => x.filter((a) => a.id !== id)); start(async () => { await deleteAsset(id); }); };
  const shown = filter === "all" ? items : items.filter((a) => a.kind === filter);
  const filters: ("all" | Tab)[] = ["all", "image", "video", "voice"];

  return (
    <section style={{ marginBlockStart: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBlockEnd: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--heading)" }}>{t("galleryTitle", { n: items.length })}</div>
        <div style={{ display: "flex", gap: 4, marginInlineStart: "auto", background: "var(--surface,#fff)", border: "1px solid var(--border)", borderRadius: 10, padding: 3 }}>
          {filters.map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", background: filter === f ? "var(--teal)" : "transparent", color: filter === f ? "#fff" : "var(--muted)" }}>{f === "all" ? t("filterAll") : t(`tab_${f}`)}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,190px),1fr))", gap: 12 }}>
        {shown.map((a) => (
          <div key={a.id} className="lift media-tile" style={{ position: "relative", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ background: "var(--bg)", display: "grid", placeItems: "center", minHeight: a.kind === "voice" ? 0 : 130 }}>
              {a.kind === "image" && <img src={a.url} alt="" style={{ width: "100%", display: "block" }} />}
              {a.kind === "video" && <video src={a.url} style={{ width: "100%", display: "block" }} muted />}
              {a.kind === "voice" && <audio controls src={a.url} style={{ width: "100%", padding: 8 }} />}
            </div>
            <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--teal-tint)", color: "var(--teal-deep)" }}>{t(`tab_${a.kind}`)}</span>
              <span style={{ fontSize: 11, color: "var(--subtle)", flex: 1 }}>{df.format(new Date(a.createdAt))}</span>
              <a href={a.url} download target="_blank" rel="noopener noreferrer" aria-label={t("download")} style={{ color: "var(--muted)", fontSize: 14, textDecoration: "none" }}>⬇</a>
              <button onClick={() => remove(a.id)} aria-label={t("delete")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--coral,#dc2626)", fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
            </div>
          </div>
        ))}
        {shown.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--muted)", fontSize: 13.5, padding: 24 }}>{t("noneOfKind")}</div>}
      </div>
    </section>
  );
}
