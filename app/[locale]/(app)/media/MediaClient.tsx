"use client";
/* eslint-disable @next/next/no-img-element -- generated/external media, not next/image-optimizable */

import { useMemo, useState, useTransition, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { btnTeal, btnGhost, GlyphIcon } from "@/components/ui/display";
import { generateVoice, generateImage, suggestImagePrompt, startVideo, pollVideo, deleteAsset } from "./actions";

export type RecentDraft = { id: string; label: string; text: string };
export type MediaAsset = { id: string; kind: string; url: string; prompt: string | null; createdAt: string };
type Tab = "voice" | "image" | "video";

const cardStyle: CSSProperties = { background: "var(--surface,#fff)", border: "1px solid var(--border)", borderRadius: 16, padding: "clamp(16px,2.4vw,22px)" };
const input: CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg,#fff)", fontSize: 14, color: "var(--heading)", fontFamily: "inherit" };
const label: CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "var(--heading)", marginBlockEnd: 6, display: "block" };

const VOICES = [
  { id: "male-qn-jingying", ar: "رجل واثق" }, { id: "male-qn-qingse", ar: "شاب" },
  { id: "female-yujie", ar: "امرأة راقية" }, { id: "female-shaonv", ar: "شابة" },
  { id: "presenter_male", ar: "مذيع" }, { id: "audiobook_male_1", ar: "راوٍ" },
];
const ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A draft picker shared by every tab — the bridge from your content to media. */
function DraftPicker({ drafts, onPick, t }: { drafts: RecentDraft[]; onPick: (d: RecentDraft) => void; t: ReturnType<typeof useTranslations> }) {
  if (!drafts.length) return null;
  return (
    <div style={{ marginBlockEnd: 12 }}>
      <label style={label}>{t("fromPost")}</label>
      <select onChange={(e) => { const d = drafts.find((x) => x.id === e.target.value); if (d) onPick(d); }} style={{ ...input, cursor: "pointer" }} defaultValue="">
        <option value="" disabled>{t("choosePost")}</option>
        {drafts.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
      </select>
    </div>
  );
}

function errMsg(error: string, t: ReturnType<typeof useTranslations>): string {
  return error === "no_key" ? t("errNoKey") : error === "insufficient_credits" ? t("errCredits") : error === "needs_credits" ? t("errVideoCredits") : error === "empty" ? t("errEmpty") : t("errGeneric");
}

export function MediaClient({ drafts, assets, keys, presetText, presetDraftId, presetTab, locale }: {
  drafts: RecentDraft[]; assets: MediaAsset[]; keys: { voice: boolean; image: boolean; video: boolean };
  presetText: string; presetDraftId: string; presetTab: Tab; locale: string;
}) {
  const t = useTranslations("Media");
  const [tab, setTab] = useState<Tab>(presetTab);
  const tabs: { k: Tab; glyph: string }[] = [{ k: "voice", glyph: "message" }, { k: "image", glyph: "target" }, { k: "video", glyph: "chart" }];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBlockEnd: 16, flexWrap: "wrap" }}>
        {tabs.map((x) => (
          <button key={x.k} onClick={() => setTab(x.k)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${tab === x.k ? "var(--teal)" : "var(--border)"}`, background: tab === x.k ? "var(--teal)" : "transparent", color: tab === x.k ? "#fff" : "var(--heading)" }}>
            <GlyphIcon name={x.glyph} size={16} /> {t(`tab_${x.k}`)}
          </button>
        ))}
      </div>

      {tab === "voice" && <VoiceTab drafts={drafts} enabled={keys.voice} presetText={presetText} presetDraftId={presetDraftId} t={t} />}
      {tab === "image" && <ImageTab drafts={drafts} enabled={keys.image} presetText={presetText} presetDraftId={presetDraftId} t={t} />}
      {tab === "video" && <VideoTab drafts={drafts} enabled={keys.video} presetText={presetText} presetDraftId={presetDraftId} t={t} />}

      <Gallery assets={assets} t={t} locale={locale} />
    </div>
  );
}

function ErrLine({ msg }: { msg: string }) {
  return <div style={{ marginBlockStart: 10, fontSize: 13, color: "var(--coral)" }}>{msg}</div>;
}
function KeyNote({ t }: { t: ReturnType<typeof useTranslations> }) {
  return <div style={{ ...cardStyle, fontSize: 13.5, color: "var(--gold-dark)" }}>{t("needKey")}</div>;
}

/* ---------- Voice ---------- */
function VoiceTab({ drafts, enabled, presetText, presetDraftId, t }: { drafts: RecentDraft[]; enabled: boolean; presetText: string; presetDraftId: string; t: ReturnType<typeof useTranslations> }) {
  const [text, setText] = useState(presetText);
  const [draftId, setDraftId] = useState(presetDraftId);
  const [voice, setVoice] = useState(VOICES[0].id);
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const router = useRouter();
  if (!enabled) return <KeyNote t={t} />;

  const go = () => start(async () => {
    setErr(""); setUrl(null);
    const r = await generateVoice(text, voice, draftId || undefined);
    if (r.ok) { setUrl(r.url); router.refresh(); } else setErr(errMsg(r.error, t));
  });

  return (
    <div style={cardStyle}>
      <DraftPicker drafts={drafts} onPick={(d) => { setText(d.text); setDraftId(d.id); }} t={t} />
      <label style={label}>{t("voiceText")}</label>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("voicePh")} rows={4} style={{ ...input, resize: "vertical" }} />
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBlockStart: 12 }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={label}>{t("voice")}</label>
          <select value={voice} onChange={(e) => setVoice(e.target.value)} style={{ ...input, cursor: "pointer" }}>
            {VOICES.map((v) => <option key={v.id} value={v.id}>{v.ar}</option>)}
          </select>
        </div>
        <button onClick={go} disabled={pending || !text.trim()} style={{ ...btnTeal, height: 42 }}>{pending ? t("generating") : t("genVoice")}</button>
      </div>
      {url && <div style={{ marginBlockStart: 14, display: "grid", gap: 8 }}>
        <audio controls src={url} style={{ width: "100%" }} />
        <span style={{ fontSize: 12, color: "var(--teal-deep)", fontWeight: 600 }}>{t("savedToGallery")}</span>
      </div>}
      {err && <ErrLine msg={err} />}
    </div>
  );
}

/* ---------- Image ---------- */
function ImageTab({ drafts, enabled, presetText, presetDraftId, t }: { drafts: RecentDraft[]; enabled: boolean; presetText: string; presetDraftId: string; t: ReturnType<typeof useTranslations> }) {
  const [postText, setPostText] = useState(presetText);
  const [draftId, setDraftId] = useState(presetDraftId);
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]>("1:1");
  const [pending, start] = useTransition();
  const [suggesting, startSuggest] = useTransition();
  const [urls, setUrls] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const router = useRouter();
  if (!enabled) return <KeyNote t={t} />;

  const suggest = () => startSuggest(async () => {
    setErr("");
    const r = await suggestImagePrompt(postText);
    if (r.ok) setPrompt(r.prompt); else setErr(errMsg(r.error, t));
  });
  const go = () => start(async () => {
    setErr(""); setUrls([]);
    const r = await generateImage(prompt, aspect, 2, draftId || undefined);
    if (r.ok) { setUrls(r.urls); router.refresh(); } else setErr(errMsg(r.error, t));
  });

  return (
    <div style={cardStyle}>
      <DraftPicker drafts={drafts} onPick={(d) => { setPostText(d.text); setDraftId(d.id); }} t={t} />
      {postText && (
        <button onClick={suggest} disabled={suggesting} style={{ ...btnGhost, height: 34, fontSize: 12.5, marginBlockEnd: 10 }}>
          ✦ {suggesting ? t("suggesting") : t("suggestVisual")}
        </button>
      )}
      <label style={label}>{t("imagePrompt")}</label>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t("imagePh")} rows={3} dir="ltr" style={{ ...input, resize: "vertical", textAlign: "start" }} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBlockStart: 12 }}>
        {ASPECTS.map((a) => (
          <button key={a} onClick={() => setAspect(a)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-latin)", border: `1px solid ${aspect === a ? "var(--teal)" : "var(--border)"}`, background: aspect === a ? "var(--teal)" : "transparent", color: aspect === a ? "#fff" : "var(--heading)" }}>{a}</button>
        ))}
        <button onClick={go} disabled={pending || !prompt.trim()} style={{ ...btnTeal, height: 40, marginInlineStart: "auto" }}>{pending ? t("generating") : t("genImage")}</button>
      </div>
      {urls.length > 0 && (
        <div style={{ marginBlockStart: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 10 }}>

          {urls.map((u, i) => <img key={i} src={u} alt="" style={{ width: "100%", borderRadius: 12, display: "block", border: "1px solid var(--border)" }} />)}
        </div>
      )}
      {urls.length > 0 && <span style={{ display: "block", marginBlockStart: 8, fontSize: 12, color: "var(--teal-deep)", fontWeight: 600 }}>{t("savedToGallery")}</span>}
      {err && <ErrLine msg={err} />}
    </div>
  );
}

/* ---------- Video ---------- */
function VideoTab({ drafts, enabled, presetText, presetDraftId, t }: { drafts: RecentDraft[]; enabled: boolean; presetText: string; presetDraftId: string; t: ReturnType<typeof useTranslations> }) {
  const [postText, setPostText] = useState(presetText);
  const [draftId, setDraftId] = useState(presetDraftId);
  const [prompt, setPrompt] = useState("");
  const [pending, start] = useTransition();
  const [suggesting, startSuggest] = useTransition();
  const [status, setStatus] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const router = useRouter();
  if (!enabled) return <KeyNote t={t} />;

  const suggest = () => startSuggest(async () => {
    setErr("");
    const r = await suggestImagePrompt(postText);
    if (r.ok) setPrompt(r.prompt); else setErr(errMsg(r.error, t));
  });
  const go = () => start(async () => {
    setErr(""); setUrl(null); setStatus(t("videoQueued"));
    const r = await startVideo(prompt);
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
    <div style={cardStyle}>
      <DraftPicker drafts={drafts} onPick={(d) => { setPostText(d.text); setDraftId(d.id); }} t={t} />
      {postText && (
        <button onClick={suggest} disabled={suggesting} style={{ ...btnGhost, height: 34, fontSize: 12.5, marginBlockEnd: 10 }}>
          ✦ {suggesting ? t("suggesting") : t("suggestVisual")}
        </button>
      )}
      <label style={label}>{t("videoPrompt")}</label>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t("videoPh")} rows={3} dir="ltr" style={{ ...input, resize: "vertical", textAlign: "start" }} />
      <button onClick={go} disabled={pending || !prompt.trim()} style={{ ...btnTeal, height: 42, marginBlockStart: 12 }}>{pending ? t("generating") : t("genVideo")}</button>
      {status && <div style={{ marginBlockStart: 12, fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}><span className="skeleton" style={{ width: 14, height: 14, borderRadius: "50%" }} />{status}</div>}
      {url && <div style={{ marginBlockStart: 14, display: "grid", gap: 8 }}><video controls src={url} style={{ width: "100%", borderRadius: 12 }} /><span style={{ fontSize: 12, color: "var(--teal-deep)", fontWeight: 600 }}>{t("savedToGallery")}</span></div>}
      {err && <ErrLine msg={err} />}
    </div>
  );
}

/* ---------- Persistent gallery ---------- */
function Gallery({ assets, t, locale }: { assets: MediaAsset[]; t: ReturnType<typeof useTranslations>; locale: string }) {
  const [items, setItems] = useState(assets);
  const [, start] = useTransition();
  const df = useMemo(() => new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { month: "short", day: "numeric" }), [locale]);
  if (!items.length) return null;
  const remove = (id: string) => { setItems((x) => x.filter((a) => a.id !== id)); start(async () => { await deleteAsset(id); }); };

  return (
    <section style={{ marginBlockStart: 24 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--heading)", marginBlockEnd: 12 }}>{t("galleryTitle", { n: items.length })}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,200px),1fr))", gap: 12 }}>
        {items.map((a) => (
          <div key={a.id} className="lift" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ background: "var(--bg)", display: "grid", placeItems: "center", minHeight: a.kind === "voice" ? 0 : 120 }}>
              {a.kind === "image" && <img src={a.url} alt="" style={{ width: "100%", display: "block" }} />}
              {a.kind === "video" && <video src={a.url} style={{ width: "100%", display: "block" }} muted />}
              {a.kind === "voice" && <audio controls src={a.url} style={{ width: "100%", padding: 8 }} />}
            </div>
            <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--teal-tint)", color: "var(--teal-deep)" }}>{t(`tab_${a.kind}`)}</span>
              <span style={{ fontSize: 11, color: "var(--subtle)", flex: 1 }}>{df.format(new Date(a.createdAt))}</span>
              <a href={a.url} download target="_blank" rel="noopener noreferrer" aria-label={t("download")} style={{ color: "var(--muted)", fontSize: 13 }}>⬇</a>
              <button onClick={() => remove(a.id)} aria-label={t("delete")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--coral)", fontSize: 15, padding: 0 }}>×</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
