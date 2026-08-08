"use client";

import { useMemo, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { btnTeal } from "@/components/ui/display";
import { startVideo, pollVideo, deleteAsset } from "../media/actions";

export type SceneAsset = { id: string; url: string; prompt: string | null; createdAt: string };
type Tab = "ugc" | "cinematic";
type Tr = ReturnType<typeof useTranslations>;

const input: CSSProperties = { width: "100%", padding: "11px 13px", borderRadius: 11, border: "1px solid var(--border)", background: "var(--bg,#fff)", fontSize: 14, color: "var(--heading)", fontFamily: "inherit", outline: "none" };
const label: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBlockEnd: 7, display: "block" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Avatar personas (culturally relevant). Each scaffolds an English scene prompt.
const PERSONAS = [
  { k: "auto", g: "✨", kw: "a friendly presenter" },
  { k: "womanHijab", g: "🧕", kw: "a professional young Gulf Arab woman wearing an elegant hijab" },
  { k: "manThobe", g: "🧔🏻", kw: "a young Gulf Arab man wearing a clean white thobe" },
  { k: "casualF", g: "🙋‍♀️", kw: "a friendly young Arab woman in modern casual clothes" },
  { k: "casualM", g: "🙋‍♂️", kw: "a friendly young Arab man in modern casual clothes" },
  { k: "business", g: "💼", kw: "a confident Arab businessperson in smart formal attire" },
];
const UGC_SCENES = [
  { k: "talking", kw: "talking directly to the camera, selfie style, holding the product up" },
  { k: "unboxing", kw: "excitedly unboxing and revealing the product" },
  { k: "demo", kw: "demonstrating how to use the product, step by step" },
  { k: "lifestyle", kw: "using the product naturally in an everyday lifestyle setting" },
];
const CINEMATIC = [
  { k: "auto", g: "✨", kw: "" },
  { k: "wide", g: "🏞️", kw: "wide establishing shot, smooth slow camera move" },
  { k: "closeup", g: "🔍", kw: "extreme close-up, shallow depth of field, crisp focus" },
  { k: "product", g: "🛍️", kw: "product hero shot, slowly rotating, studio lighting" },
  { k: "dramatic", g: "🌩️", kw: "dramatic cinematic lighting, moody atmosphere, film grain" },
  { k: "warm", g: "🌅", kw: "warm golden-hour light, soft and inviting" },
];

function errMsg(error: string, t: Tr): string {
  return error === "no_key" ? t("errNoKey") : error === "insufficient_credits" ? t("errCredits") : error === "needs_credits" ? t("errVideoCredits") : error === "empty" ? t("errEmpty") : t("errGeneric");
}
function Panel({ children }: { children: ReactNode }) {
  return <div style={{ background: "var(--surface,#fff)", border: "1px solid var(--border)", borderRadius: 18, padding: "clamp(16px,2.2vw,22px)" }}>{children}</div>;
}
function ModelPill({ t }: { t: Tr }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 11, background: "var(--teal-tint,#e6f2f0)", border: "1px solid color-mix(in srgb,var(--teal) 25%, var(--border))", marginBlockEnd: 14 }}>
      <span style={{ width: 22, height: 22, borderRadius: 7, display: "grid", placeItems: "center", background: "linear-gradient(160deg,var(--teal),var(--teal-deep))", color: "#fff", fontSize: 12 }}>✦</span>
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: "var(--teal-deep)", fontFamily: "var(--font-latin)" }}>MiniMax Video · Hailuo</span>
      <span style={{ fontSize: 11, color: "var(--teal-deep)", opacity: 0.75 }}>{t("vertical")}</span>
    </div>
  );
}

export function ScenesClient({ assets, keys, locale }: { assets: SceneAsset[]; keys: boolean; locale: string }) {
  const t = useTranslations("Scenes");
  const [tab, setTab] = useState<Tab>("ugc");
  const df = useMemo(() => new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { month: "short", day: "numeric" }), [locale]);
  const [items, setItems] = useState(assets);
  const [, startDel] = useTransition();
  const remove = (id: string) => { setItems((x) => x.filter((a) => a.id !== id)); startDel(async () => { await deleteAsset(id); }); };

  if (!keys) return <Panel><div style={{ fontSize: 13.5, color: "var(--gold-dark)" }}>{t("needKey")}</div></Panel>;

  return (
    <div>
      <div style={{ display: "inline-flex", gap: 4, padding: 5, background: "var(--surface,#fff)", border: "1px solid var(--border)", borderRadius: 14, marginBlockEnd: 18, flexWrap: "wrap" }}>
        {(["ugc", "cinematic"] as Tab[]).map((k) => (
          <button key={k} onClick={() => setTab(k)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", border: "none", background: tab === k ? "var(--teal)" : "transparent", color: tab === k ? "#fff" : "var(--muted)" }}>
            <span style={{ fontSize: 15 }}>{k === "ugc" ? "🤳" : "🎬"}</span> {t(`tab_${k}`)}
          </button>
        ))}
      </div>

      {tab === "ugc" ? <UgcTab t={t} /> : <CinematicTab t={t} />}

      {items.length > 0 && (
        <section style={{ marginBlockStart: 30 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--heading)", marginBlockEnd: 14 }}>{t("galleryTitle", { n: items.length })}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,190px),1fr))", gap: 12 }}>
            {items.map((a) => (
              <div key={a.id} className="lift media-tile" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                <video src={a.url} style={{ width: "100%", display: "block" }} muted controls />
                <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--subtle)", flex: 1 }}>{df.format(new Date(a.createdAt))}</span>
                  <a href={a.url} download target="_blank" rel="noopener noreferrer" style={{ color: "var(--muted)", fontSize: 14, textDecoration: "none" }}>⬇</a>
                  <button onClick={() => remove(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--coral,#dc2626)", fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Shared generate flow: compose an English prompt, submit, poll to completion. */
function useGenerate(t: Tr) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const run = (prompt: string) => start(async () => {
    setErr(""); setUrl(null); setStatus(t("queued"));
    const r = await startVideo(prompt);
    if (!r.ok) { setStatus(""); setErr(errMsg(r.error, t)); return; }
    for (let i = 0; i < 60; i++) {
      await sleep(5000);
      const s = await pollVideo(r.taskId, prompt);
      if (s.status === "success" && s.url) { setUrl(s.url); setStatus(""); router.refresh(); return; }
      if (s.status === "fail") { setStatus(""); setErr(t("errGeneric")); return; }
      setStatus(t("processing"));
    }
    setStatus(""); setErr(t("errTimeout"));
  });
  return { pending, status, url, err, run };
}

function StatusBlock({ status, url, err, t }: { status: string; url: string | null; err: string; t: Tr }) {
  return (
    <>
      {status && <div style={{ marginBlockStart: 14, fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}><span className="skeleton" style={{ width: 14, height: 14, borderRadius: "50%" }} />{status}</div>}
      {url && <div style={{ marginBlockStart: 14, display: "grid", gap: 8 }}><video controls src={url} style={{ width: "100%", borderRadius: 12 }} /><span style={{ fontSize: 12, color: "var(--teal-deep)", fontWeight: 600 }}>{t("savedToGallery")}</span></div>}
      {err && <div style={{ marginBlockStart: 10, fontSize: 13, color: "var(--coral,#dc2626)" }}>{err}</div>}
    </>
  );
}

/* ---------- UGC / Avatar ---------- */
function UgcTab({ t }: { t: Tr }) {
  const [product, setProduct] = useState("");
  const [script, setScript] = useState("");
  const [persona, setPersona] = useState("auto");
  const [scene, setScene] = useState("talking");
  const { pending, status, url, err, run } = useGenerate(t);

  const go = () => {
    const p = PERSONAS.find((x) => x.k === persona)?.kw ?? "";
    const sc = UGC_SCENES.find((x) => x.k === scene)?.kw ?? "";
    const prompt = [
      `UGC-style vertical video (9:16). ${p}, ${sc}.`,
      product ? `The product is: ${product}.` : "",
      script ? `Key talking points: ${script}.` : "",
      "Authentic, natural lighting, energetic and trustworthy.",
    ].filter(Boolean).join(" ");
    run(prompt);
  };

  return (
    <div className="media-studio">
      <Panel>
        <ModelPill t={t} />
        <label style={label}>{t("productLabel")}</label>
        <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder={t("productPh")} style={input} />
        <label style={{ ...label, marginBlockStart: 14 }}>{t("scriptLabel")}</label>
        <textarea value={script} onChange={(e) => setScript(e.target.value)} placeholder={t("scriptPh")} rows={3} style={{ ...input, resize: "vertical" }} />
        <label style={{ ...label, marginBlockStart: 14 }}>{t("sceneType")}</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {UGC_SCENES.map((s) => {
            const on = scene === s.k;
            return <button key={s.k} onClick={() => setScene(s.k)} style={{ padding: "7px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${on ? "var(--teal)" : "var(--border)"}`, background: on ? "var(--teal-tint,#e6f2f0)" : "transparent", color: on ? "var(--teal-deep)" : "var(--heading)" }}>{t(`ugc_${s.k}`)}</button>;
          })}
        </div>
        <button onClick={go} disabled={pending} style={{ ...btnTeal, height: 46, width: "100%", marginBlockStart: 18, fontSize: 14.5 }}>{pending ? t("generating") : t("genUgc")}</button>
        <p style={{ fontSize: 11.5, color: "var(--subtle)", marginBlockStart: 10, lineHeight: 1.6 }}>{t("ugcNote")}</p>
        <StatusBlock status={status} url={url} err={err} t={t} />
      </Panel>
      <Panel>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--heading)", marginBlockEnd: 14 }}>{t("choosePresenter")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(92px,1fr))", gap: 8 }}>
          {PERSONAS.map((p) => {
            const on = persona === p.k;
            return (
              <button key={p.k} onClick={() => setPersona(p.k)} className="lift" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "16px 8px", borderRadius: 12, cursor: "pointer", border: `1.5px solid ${on ? "var(--teal)" : "var(--border)"}`, background: on ? "var(--teal-tint,#e6f2f0)" : "var(--card,#fff)" }}>
                <span style={{ fontSize: 26 }}>{p.g}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: on ? "var(--teal-deep)" : "var(--heading)", textAlign: "center", lineHeight: 1.3 }}>{t(`persona_${p.k}`)}</span>
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

/* ---------- Cinematic (text → scene) ---------- */
function CinematicTab({ t }: { t: Tr }) {
  const [desc, setDesc] = useState("");
  const [mood, setMood] = useState("auto");
  const { pending, status, url, err, run } = useGenerate(t);

  const go = () => {
    const kw = CINEMATIC.find((x) => x.k === mood)?.kw ?? "";
    run([desc.trim(), kw, "cinematic quality, high detail"].filter(Boolean).join(", "));
  };

  return (
    <div className="media-studio">
      <Panel>
        <ModelPill t={t} />
        <label style={label}>{t("sceneDesc")}</label>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("sceneDescPh")} rows={4} dir="ltr" style={{ ...input, resize: "vertical", textAlign: "start" }} />
        <button onClick={go} disabled={pending || !desc.trim()} style={{ ...btnTeal, height: 46, width: "100%", marginBlockStart: 16, fontSize: 14.5 }}>{pending ? t("generating") : t("genScene")}</button>
        <StatusBlock status={status} url={url} err={err} t={t} />
      </Panel>
      <Panel>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--heading)", marginBlockEnd: 14 }}>{t("moodPresets")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(92px,1fr))", gap: 8 }}>
          {CINEMATIC.map((m) => {
            const on = mood === m.k;
            return (
              <button key={m.k} onClick={() => setMood(m.k)} className="lift" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "16px 8px", borderRadius: 12, cursor: "pointer", border: `1.5px solid ${on ? "var(--teal)" : "var(--border)"}`, background: on ? "var(--teal-tint,#e6f2f0)" : "var(--card,#fff)" }}>
                <span style={{ fontSize: 24 }}>{m.g}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: on ? "var(--teal-deep)" : "var(--heading)", textAlign: "center", lineHeight: 1.3 }}>{t(`mood_${m.k}`)}</span>
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
