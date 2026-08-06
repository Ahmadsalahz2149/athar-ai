"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { btnTeal, btnGhost, GlyphIcon } from "@/components/ui/display";
import { generateVoice, generateImage, startVideo, pollVideo } from "./actions";

export type RecentDraft = { id: string; label: string; text: string };

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

export function MediaClient({ drafts, keys }: { drafts: RecentDraft[]; keys: { voice: boolean; image: boolean; video: boolean } }) {
  const t = useTranslations("Media");
  const [tab, setTab] = useState<"voice" | "image" | "video">("voice");

  const tabs: { k: "voice" | "image" | "video"; glyph: string }[] = [
    { k: "voice", glyph: "message" }, { k: "image", glyph: "bulb" }, { k: "video", glyph: "trophy" },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBlockEnd: 16, flexWrap: "wrap" }}>
        {tabs.map((x) => (
          <button key={x.k} onClick={() => setTab(x.k)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${tab === x.k ? "var(--teal)" : "var(--border)"}`, background: tab === x.k ? "var(--teal)" : "transparent", color: tab === x.k ? "#fff" : "var(--heading)" }}>
            <GlyphIcon name={x.glyph} size={16} /> {t(`tab_${x.k}`)}
          </button>
        ))}
      </div>
      {tab === "voice" && <VoiceTab drafts={drafts} enabled={keys.voice} t={t} />}
      {tab === "image" && <ImageTab enabled={keys.image} t={t} />}
      {tab === "video" && <VideoTab enabled={keys.video} t={t} />}
    </div>
  );
}

function ErrLine({ msg }: { msg: string }) {
  return <div style={{ fontSize: 12.8, color: "var(--danger,#dc2626)", marginBlockStart: 10 }}>{msg}</div>;
}

/* ---------- Voice ---------- */
function VoiceTab({ drafts, enabled, t }: { drafts: RecentDraft[]; enabled: boolean; t: ReturnType<typeof useTranslations> }) {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(VOICES[0].id);
  const [pending, start] = useTransition();
  const [audio, setAudio] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const run = () =>
    start(async () => {
      setErr(""); setAudio(null);
      const r = await generateVoice(text, voice);
      if (r.ok) setAudio(r.audio);
      else setErr(errMsg(r.error, t));
    });

  return (
    <section style={cardStyle} className="lift">
      <div style={{ display: "grid", gap: 12 }}>
        {drafts.length > 0 && (
          <div>
            <label style={label}>{t("fromDraft")}</label>
            <select onChange={(e) => { const d = drafts.find((x) => x.id === e.target.value); if (d) setText(d.text); }} style={{ ...input, cursor: "pointer" }} defaultValue="">
              <option value="" disabled>{t("pickDraft")}</option>
              {drafts.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
        )}
        <div>
          <label style={label}>{t("voiceText")}</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("voicePh")} rows={4} style={{ ...input, resize: "vertical" }} />
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select value={voice} onChange={(e) => setVoice(e.target.value)} style={{ ...input, width: "auto", cursor: "pointer" }}>
            {VOICES.map((v) => <option key={v.id} value={v.id}>{v.ar}</option>)}
          </select>
          <button onClick={run} disabled={pending || !enabled || text.trim().length < 4} style={{ ...btnTeal, height: 42, opacity: pending || !enabled ? 0.7 : 1 }}>
            {pending ? t("generating") : t("genVoice")}
          </button>
        </div>
        {!enabled && <div style={{ fontSize: 12.8, color: "var(--gold-dark)" }}>{t("noKey")}</div>}
        {audio && (
          <div style={{ display: "grid", gap: 8 }}>
            <audio controls src={audio} style={{ width: "100%" }} />
            <a href={audio} download="voiceover.mp3" style={{ ...btnGhost, height: 36, width: "fit-content", fontSize: 12.5 }}>{t("download")}</a>
          </div>
        )}
        {err && <ErrLine msg={err} />}
      </div>
    </section>
  );
}

/* ---------- Image ---------- */
function ImageTab({ enabled, t }: { enabled: boolean; t: ReturnType<typeof useTranslations> }) {
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]>("1:1");
  const [pending, start] = useTransition();
  const [urls, setUrls] = useState<string[]>([]);
  const [err, setErr] = useState("");

  const run = () =>
    start(async () => {
      setErr(""); setUrls([]);
      const r = await generateImage(prompt, aspect, 2);
      if (r.ok) setUrls(r.urls);
      else setErr(errMsg(r.error, t));
    });

  return (
    <section style={cardStyle} className="lift">
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={label}>{t("imagePrompt")}</label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t("imagePh")} rows={3} style={{ ...input, resize: "vertical" }} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {ASPECTS.map((a) => (
            <button key={a} onClick={() => setAspect(a)} style={{ padding: "7px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font-latin)", cursor: "pointer", border: `1px solid ${aspect === a ? "var(--teal)" : "var(--border)"}`, background: aspect === a ? "var(--teal)" : "transparent", color: aspect === a ? "#fff" : "var(--heading)" }}>{a}</button>
          ))}
          <button onClick={run} disabled={pending || !enabled || !prompt.trim()} style={{ ...btnTeal, height: 40, marginInlineStart: "auto", opacity: pending || !enabled ? 0.7 : 1 }}>
            {pending ? t("generating") : t("genImage")}
          </button>
        </div>
        {!enabled && <div style={{ fontSize: 12.8, color: "var(--gold-dark)" }}>{t("noKey")}</div>}
        {urls.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,220px),1fr))", gap: 12 }}>
            {urls.map((u, i) => (
              <div key={i} style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" style={{ width: "100%", display: "block" }} />
                <a href={u} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", padding: "8px", fontSize: 12.5, fontWeight: 600, color: "var(--teal-deep)", textDecoration: "none" }}>{t("openFull")} ↗</a>
              </div>
            ))}
          </div>
        )}
        {err && <ErrLine msg={err} />}
      </div>
    </section>
  );
}

/* ---------- Video ---------- */
function VideoTab({ enabled, t }: { enabled: boolean; t: ReturnType<typeof useTranslations> }) {
  const [prompt, setPrompt] = useState("");
  const [pending, start] = useTransition();
  const [status, setStatus] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const run = () =>
    start(async () => {
      setErr(""); setUrl(null); setStatus(t("submitting"));
      const r = await startVideo(prompt);
      if (!r.ok) { setStatus(""); setErr(r.error === "needs_credits" ? t("videoNeedsCredits") : errMsg(r.error, t)); return; }
      for (let i = 0; i < 60; i++) {
        await sleep(5000);
        const s = await pollVideo(r.taskId);
        setStatus(t(`vstatus_${s.status}`));
        if (s.status === "success") { setUrl(s.url ?? null); return; }
        if (s.status === "fail") { setErr(t("videoFailed")); setStatus(""); return; }
      }
      setStatus(""); setErr(t("videoTimeout"));
    });

  return (
    <section style={cardStyle} className="lift">
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={label}>{t("videoPrompt")}</label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t("videoPh")} rows={3} style={{ ...input, resize: "vertical" }} />
        </div>
        <button onClick={run} disabled={pending || !enabled || !prompt.trim()} style={{ ...btnTeal, height: 42, width: "fit-content", opacity: pending || !enabled ? 0.7 : 1 }}>
          {pending ? (status || t("generating")) : t("genVideo")}
        </button>
        {pending && status && <div style={{ fontSize: 12.8, color: "var(--muted)" }}>{status} — {t("videoWait")}</div>}
        {!enabled && <div style={{ fontSize: 12.8, color: "var(--gold-dark)" }}>{t("noKey")}</div>}
        {url && (
          <div style={{ display: "grid", gap: 8 }}>
            <video controls src={url} style={{ width: "100%", borderRadius: 12 }} />
            <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...btnGhost, height: 36, width: "fit-content", fontSize: 12.5 }}>{t("download")}</a>
          </div>
        )}
        {err && <ErrLine msg={err} />}
      </div>
    </section>
  );
}

function errMsg(error: string, t: ReturnType<typeof useTranslations>): string {
  return error === "no_key" ? t("noKey") : error === "insufficient_credits" ? t("errCredits") : error === "empty" ? t("errEmpty") : t("errGeneric");
}
