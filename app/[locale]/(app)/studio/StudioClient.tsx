"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { studioGenerate, studioRewrite, setDraftState, suggestHashtags, translatePost, repurposePost, type StudioResult, type StudioSource } from "./actions";
import { SlideEditor } from "./SlideEditor";
import { postScore, dnaMatch, scoreBreakdown } from "@/lib/ai/score";
import { checkContent } from "@/lib/ai/guardrails";
import {
  PROVIDERS,
  MODEL_CATALOG,
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  type ProviderId,
} from "@/lib/ai/catalog";
import {
  ScoreRadial,
  ProgressMeter,
  FileTypeBadge,
  StatusPill,
  btnTeal,
  btnGhost,
} from "@/components/ui/display";

const PLATFORMS = ["LinkedIn", "X / Twitter", "Instagram"] as const;
const FORMATS = ["post", "thread", "carousel", "reel"] as const;
const LENGTHS = ["short", "medium", "long"] as const;
const TOOLS = ["regenerate", "longer", "shorter", "emoji", "tone"] as const;

export function StudioClient({
  sources,
  tones,
  initialPrompt = "",
  initialSourceId = "",
}: {
  sources: StudioSource[];
  tones: string[];
  initialPrompt?: string;
  initialSourceId?: string;
}) {
  const t = useTranslations("Studio");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");

  const toneOptions = tones.length ? tones : [t("toneFallback")];
  const [prompt, setPrompt] = useState(initialPrompt);
  const [platform, setPlatform] = useState<string>(PLATFORMS[0]);
  const [format, setFormat] = useState<string>("post");
  const [tone, setTone] = useState<string>(toneOptions[0]);
  const [length, setLength] = useState<string>("medium");
  const [sourceId, setSourceId] = useState<string>(initialSourceId || sources[0]?.id || "");
  const [provider, setProvider] = useState<ProviderId>(DEFAULT_PROVIDER);
  const [model, setModel] = useState<string>(DEFAULT_MODEL);

  const [result, setResult] = useState<StudioResult | null>(null);
  const [hookIdx, setHookIdx] = useState(0);
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const prevBody = useRef<string | null>(null); // one-level undo before a rewrite/regenerate
  const [canUndo, setCanUndo] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagsBusy, setTagsBusy] = useState(false);
  const [trans, setTrans] = useState<{ hook: string; body: string } | null>(null);
  const [transBusy, setTransBusy] = useState(false);
  const [repBusy, setRepBusy] = useState<string | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savedSig, setSavedSig] = useState<string | null>(null);

  const ok = result?.ok ? result : null;
  const hook = ok ? ok.hooks[hookIdx] ?? ok.hooks[0] : "";
  const dna = ok?.dna ?? null;

  // Scores recompute live on hook swap / body edit (design behavior).
  const scores = useMemo(() => {
    if (!ok) return { ps: 0, dm: 0 };
    return { ps: postScore(hook, body), dm: dnaMatch(`${hook}\n${body}`, dna) };
  }, [ok, hook, body, dna]);

  const guard = ok ? checkContent(`${hook}\n${body}`) : { ok: true, violations: [] };
  const src = sources.find((s) => s.id === sourceId);

  const generate = () => {
    prevBody.current = ok ? body : null;
    setResult(null);
    setSaved(null);
    start(async () => {
      const r = await studioGenerate({ prompt, platform, format, tone, length, sourceId: sourceId || undefined, provider, model });
      setResult(r);
      if (r.ok) {
        setHookIdx(0);
        setBody(r.body);
        setCanUndo(false);
      }
    });
  };

  const rewrite = (tool: string) => {
    if (!ok) return;
    const original = body;
    prevBody.current = original; // snapshot for undo
    setBusy(tool);
    start(async () => {
      // Anthropic: stream the rewrite so the editor fills token-by-token.
      if (provider === "anthropic") {
        try {
          const res = await fetch("/api/studio/rewrite-stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body: original, tool, model }),
          });
          if (res.ok && res.body) {
            const reader = res.body.getReader();
            const dec = new TextDecoder();
            let acc = "";
            setBody("");
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              acc += dec.decode(value, { stream: true });
              setBody(acc.replace(/\n ERROR$/, ""));
            }
            const finalText = acc.replace(/\n ERROR$/, "").trim();
            if (finalText) { setBody(finalText); setBusy(null); setCanUndo(true); return; }
            setBody(original); // nothing produced → restore and fall back
          }
        } catch {
          setBody(original);
        }
      }
      // Fallback (MiniMax or stream failure): non-streaming action.
      const r = await studioRewrite({ body: original, tool, provider, model });
      setBusy(null);
      if (r.ok) { setBody(r.body); setCanUndo(true); }
    });
  };

  const undo = () => {
    if (prevBody.current == null) return;
    setBody(prevBody.current);
    prevBody.current = null;
    setCanUndo(false);
  };

  const getTags = () => {
    setTagsBusy(true);
    setTags([]);
    start(async () => {
      const r = await suggestHashtags({ body, provider, model });
      setTagsBusy(false);
      if (r.ok) setTags(r.hashtags);
    });
  };

  const addTag = (tag: string) => {
    if (body.includes(tag)) return;
    prevBody.current = body;
    setCanUndo(true);
    setBody((b) => `${b.trimEnd()}\n\n${tag}`);
    setTags((ts) => ts.filter((t) => t !== tag));
  };

  // Bilingual: target is the opposite of whatever the body is written in.
  const target: "ar" | "en" = /[؀-ۿ]/.test(body) ? "en" : "ar";
  const translate = () => {
    setTransBusy(true);
    setTrans(null);
    start(async () => {
      const r = await translatePost({ hook, body, target, provider, model });
      setTransBusy(false);
      if (r.ok) setTrans({ hook: r.hook, body: r.body });
    });
  };
  const repurpose = (kind: "thread" | "carousel" | "reel") => {
    setRepBusy(kind);
    start(async () => {
      const r = await repurposePost({ hook, body, target: kind, provider, model });
      setRepBusy(null);
      if (r.ok) {
        prevBody.current = body;
        setCanUndo(true);
        if (r.hook) setResult((prev) => (prev && prev.ok ? { ...prev, hooks: prev.hooks.map((h, i) => (i === hookIdx ? r.hook : h)) } : prev));
        setFormat(r.format);
        setBody(r.body);
      }
    });
  };

  const useTranslation = () => {
    if (!trans) return;
    prevBody.current = body;
    setCanUndo(true);
    if (trans.hook) {
      setResult((prev) => (prev && prev.ok ? { ...prev, hooks: prev.hooks.map((h, i) => (i === hookIdx ? trans.hook : h)) } : prev));
    }
    setBody(trans.body);
    setTrans(null);
  };

  const act = (state: "draft" | "pending" | "scheduled", labelKey: string) => {
    if (!ok?.id) return;
    start(async () => {
      const r = await setDraftState(ok.id!, state);
      if (r.ok) setSaved(labelKey);
    });
  };

  // Autosave the draft (debounced). `autosaved` is derived by comparing the current
  // content signature against the last-saved one — no synchronous setState in the effect.
  const contentSig = `${ok?.id ?? ""}::${hookIdx}::${body}`;
  const autosaved = !!ok?.id && savedSig === contentSig;
  useEffect(() => {
    if (!ok?.id || savedSig === contentSig) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    const sig = contentSig;
    autosaveTimer.current = setTimeout(() => {
      setDraftState(ok.id!, "draft").then(() => setSavedSig(sig));
    }, 1500);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentSig, ok?.id]);

  // Keyboard shortcuts: ⌘/Ctrl+Enter generate · ⌘S save · ⌘Z undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === "Enter") { e.preventDefault(); if (!pending) generate(); }
      else if (e.key.toLowerCase() === "s") { e.preventDefault(); if (ok?.id) act("draft", "savedDraft"); }
      else if (e.key.toLowerCase() === "z" && canUndo) { e.preventDefault(); undo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, ok?.id, canUndo, body, prompt]);

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: "clamp(18px,3vw,28px) clamp(14px,3vw,28px) 90px", animation: "floatUp .4s ease" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBlockEnd: 18 }}>
        <div>
          {ok && <StatusPill tone="teal">✦ {t("voiceBadge", { pct: nf.format(scores.dm) })}</StatusPill>}
          <h1 style={{ fontSize: "clamp(21px,3vw,26px)", fontWeight: 700, color: "var(--heading)", marginBlockStart: 8 }}>{t("title")}</h1>
          <p style={{ fontSize: 14, color: "var(--muted)", marginBlockStart: 4 }}>{t("subtitle")}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => act("pending", "submitted")} disabled={!ok?.id || pending} style={{ ...btnTeal, opacity: !ok?.id ? 0.5 : 1 }}>{t("submit")}</button>
          <button onClick={() => act("scheduled", "scheduled")} disabled={!ok?.id || pending} style={{ ...btnGhost, opacity: !ok?.id ? 0.5 : 1 }}>{t("schedule")}</button>
          <button onClick={() => act("draft", "savedDraft")} disabled={!ok?.id || pending} style={{ ...btnGhost, opacity: !ok?.id ? 0.5 : 1 }}>{t("saveDraft")}</button>
        </div>
      </div>
      {saved && <p style={{ marginBlockEnd: 12, color: "var(--teal-deep)", fontWeight: 600, fontSize: 13.5 }}>{t(saved)}</p>}

      <div className="studio-grid">
        {/* RIGHT rail — settings */}
        <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div style={card}>
            <div style={label}>{t("source")}</div>
            {sources.length ? (
              <div style={{ display: "grid", gap: 8, marginBlockStart: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", borderRadius: 11, background: "var(--surface)", border: "1px solid var(--border)" }}>
                  {src && <FileTypeBadge label={src.label} size={28} />}
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{src?.title ?? t("noSource")}</span>
                </div>
                <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} style={field}>
                  <option value="">{t("noSource")}</option>
                  {sources.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
            ) : (
              <p style={{ fontSize: 12.5, color: "var(--muted)", marginBlockStart: 8 }}>{t("noSources")}</p>
            )}
          </div>

          <div style={card}>
            <Group title={t("platform")}>
              {PLATFORMS.map((p) => <Pill key={p} on={platform === p} onClick={() => setPlatform(p)}>{p}</Pill>)}
            </Group>
            <Group title={t("format")}>
              {FORMATS.map((f) => <Pill key={f} on={format === f} onClick={() => setFormat(f)}>{t(`fmt_${f}`)}</Pill>)}
            </Group>
            <Group title={t("tone")} hint={t("fromDna")}>
              {toneOptions.map((tn) => <Pill key={tn} on={tone === tn} onClick={() => setTone(tn)}>{tn}</Pill>)}
            </Group>
            <Group title={t("length")}>
              {LENGTHS.map((l) => <Pill key={l} on={length === l} onClick={() => setLength(l)}>{t(`len_${l}`)}</Pill>)}
            </Group>
          </div>

          <div style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,170px),1fr))", gap: 10 }}>
              <div>
                <div style={label}>{t("providerLabel")}</div>
                <select value={provider} onChange={(e) => { const p = e.target.value as ProviderId; setProvider(p); setModel(MODEL_CATALOG[p][0].id); }} style={field}>
                  {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <div style={label}>{t("modelLabel")}</div>
                <select value={model} onChange={(e) => setModel(e.target.value)} style={field}>
                  {MODEL_CATALOG[provider].map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER — compose */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div style={{ background: "linear-gradient(160deg,var(--navy-2),var(--navy))", borderRadius: 14, padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 9, background: "rgba(15, 118, 110,.18)", color: "var(--teal-light)", flex: "none" }}>✦</span>
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t("promptPh")} onKeyDown={(e) => e.key === "Enter" && !pending && generate()} style={{ flex: 1, height: 40, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 14 }} />
            <button onClick={generate} disabled={pending} style={{ ...btnTeal, height: 40, opacity: pending ? 0.7 : 1 }}>{pending && !busy ? t("generating") : t("generate")}</button>
          </div>

          {result && !result.ok && (
            <p style={notice}>
              {result.error === "no_dna" ? t("needDna") : result.error === "no_key" ? t("needKey") : result.error === "insufficient_credits" ? t("insufficientCredits") : `${t("error")}${result.message ? ` (${result.message})` : ""}`}
            </p>
          )}

          {ok && (
            <>
              {/* Hook chooser */}
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBlockEnd: 12 }}>
                  <span style={{ fontWeight: 700, color: "var(--heading)", fontSize: 14.5 }}>{t("hookChooser")}</span>
                  <button onClick={() => generate()} style={{ background: "none", border: "none", color: "var(--teal-deep)", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>{t("otherVariants")}</button>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {ok.hooks.map((h, i) => {
                    const on = i === hookIdx;
                    const hs = postScore(h, body); // per-hook predicted score so the choice is informed
                    return (
                      <button key={i} onClick={() => setHookIdx(i)} style={{ textAlign: "start", display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 11, cursor: "pointer", background: on ? "var(--teal-tint-2)" : "var(--surface)", border: on ? "1.5px solid var(--teal)" : "1px solid var(--border)" }}>
                        <span style={{ width: 18, height: 18, flex: "none", marginBlockStart: 2, borderRadius: "50%", display: "grid", placeItems: "center", background: on ? "var(--teal)" : "transparent", border: on ? "none" : "1.5px solid var(--border-2)" }}>
                          {on && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
                        </span>
                        <span style={{ flex: 1, fontSize: 14, color: "var(--slate)", lineHeight: 1.7 }}>{h}</span>
                        <span title={t("hookScoreHint")} style={{ flex: "none", fontSize: 11, fontWeight: 800, fontFamily: "var(--font-latin)", color: hs >= 75 ? "var(--teal-deep)" : hs >= 60 ? "var(--gold-dark)" : "var(--muted)", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 7, padding: "2px 7px", marginBlockStart: 1 }}>{nf.format(hs)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Editor toolbar */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {TOOLS.map((tool) => (
                  <button key={tool} onClick={() => rewrite(tool)} disabled={pending} style={{ ...btnGhost, height: 36, fontSize: 12.5, opacity: busy === tool ? 0.6 : 1 }}>
                    {tool === "regenerate" ? "↺ " : ""}{t(`tool_${tool}`)}
                  </button>
                ))}
                <button onClick={getTags} disabled={pending || body.trim().length < 20} style={{ ...btnGhost, height: 36, fontSize: 12.5, opacity: tagsBusy ? 0.6 : 1 }}># {t("suggestTags")}</button>
                <button onClick={translate} disabled={pending || body.trim().length < 10} style={{ ...btnGhost, height: 36, fontSize: 12.5, opacity: transBusy ? 0.6 : 1 }}>🌐 {target === "en" ? t("toEnglish") : t("toArabic")}</button>
                {canUndo && (
                  <button onClick={undo} disabled={pending} title="⌘Z" style={{ ...btnGhost, height: 36, fontSize: 12.5, color: "var(--gold-dark)", borderColor: "var(--gold)" }}>↶ {t("undo")}</button>
                )}
                <span style={{ marginInlineStart: "auto", fontSize: 11.5, color: "var(--subtle)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  {autosaved ? <>✓ {t("autosaved")}</> : ok?.id ? t("autosaving") : null}
                </span>
              </div>

              {/* Repurpose row (Phase: general features) */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", paddingBlock: 4 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>♻ {t("repurposeTo")}</span>
                {(["thread", "carousel", "reel"] as const).map((k) => (
                  <button key={k} onClick={() => repurpose(k)} disabled={pending || body.trim().length < 20} style={{ height: 32, padding: "0 12px", borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--card)", color: "var(--slate)", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: repBusy === k ? 0.6 : 1, whiteSpace: "nowrap" }}>
                    {repBusy === k ? t("repurposing") : t(`rep_${k}`)}
                  </button>
                ))}
              </div>

              {/* Editor */}
              <div style={card}>
                <div style={{ fontWeight: 700, color: "var(--heading)", fontSize: 15.5, lineHeight: 1.7, marginBlockEnd: 10 }}>{hook}</div>
                {format === "thread" || format === "carousel" ? (
                  <SlideEditor
                    body={body}
                    onChange={setBody}
                    mode={format}
                    nf={nf}
                    labels={{ slide: t("slide"), tweet: t("tweet"), add: format === "thread" ? t("addTweet") : t("addSlide"), remove: t("removeSlide"), up: t("moveUp"), down: t("moveDown"), overLimit: t("overLimit") }}
                  />
                ) : (
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} className="scb" style={{ width: "100%", border: "none", outline: "none", background: "transparent", resize: "vertical", fontSize: 14.5, color: "var(--slate)", lineHeight: 1.95, fontFamily: "inherit" }} />
                )}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBlockStart: 10, fontSize: 12, color: "var(--muted)" }}>
                  <span>{format === "thread" || format === "carousel" ? t("slideCount", { n: nf.format(body.split(/\n{2,}/).filter((s) => s.trim()).length) }) : t("wordCount", { n: nf.format(body.trim().split(/\s+/).filter(Boolean).length) })}</span>
                  <span style={{ color: "var(--teal-deep)", fontWeight: 600 }}>{t("dnaMatchInline", { pct: nf.format(scores.dm) })}</span>
                </div>
                {(transBusy || trans) && (
                  <div dir={target === "en" ? "ltr" : "rtl"} style={{ marginBlockStart: 12, padding: 14, borderRadius: 12, border: "1px solid var(--teal)", background: "var(--teal-tint)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBlockEnd: 8 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--teal-deep)" }}>🌐 {target === "en" ? t("englishVersion") : t("arabicVersion")}</span>
                      {trans && <button onClick={useTranslation} style={{ ...btnTeal, height: 30, fontSize: 12 }}>{t("useTranslation")}</button>}
                    </div>
                    {transBusy ? (
                      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("translating")}</div>
                    ) : trans ? (
                      <>
                        {trans.hook && <div style={{ fontWeight: 700, color: "var(--heading)", fontSize: 14, lineHeight: 1.6, marginBlockEnd: 6 }}>{trans.hook}</div>}
                        <div style={{ fontSize: 13.5, color: "var(--slate)", lineHeight: 1.85, whiteSpace: "pre-wrap" }}>{trans.body}</div>
                      </>
                    ) : null}
                  </div>
                )}
                {(tagsBusy || tags.length > 0) && (
                  <div style={{ marginBlockStart: 12, paddingBlockStart: 12, borderBlockStart: "1px dashed var(--border)" }}>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginBlockEnd: 8 }}>{tagsBusy ? t("suggestingTags") : t("tapToAdd")}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {tags.map((tag) => (
                        <button key={tag} onClick={() => addTag(tag)} style={{ height: 30, padding: "0 12px", borderRadius: 999, border: "1px solid var(--teal)", background: "var(--teal-tint)", color: "var(--teal-deep)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-latin)", direction: "ltr" }}>
                          {tag} <span style={{ opacity: 0.6, marginInlineStart: 2 }}>+</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* LEFT rail — preview + scores */}
        {ok && (
          <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <div style={card}>
              <div style={label}>{t("livePreview")}</div>
              <div style={{ marginBlockStart: 12, padding: 14, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBlockEnd: 10 }}>
                  <span style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,var(--navy-2),var(--navy))", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13 }}>{t("previewInitial")}</span>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--heading)" }}>{t("previewName")}</div>
                    <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{t("previewMeta")}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: "var(--heading)", fontSize: 13.5, lineHeight: 1.6, marginBlockEnd: 6 }}>{hook}</div>
                <div style={{ fontSize: 12.5, color: "var(--slate-2)", lineHeight: 1.75, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-wrap" }}>{body}</div>
                <div style={{ display: "flex", gap: 16, marginBlockStart: 12, fontSize: 11.5, color: "var(--muted)", fontFamily: "var(--font-latin)" }}>
                  <span>👍 {nf.format(Math.round(scores.ps * 2.6))}</span>
                  <span>💬 {nf.format(Math.round(scores.ps / 3))}</span>
                  <span>♻ {nf.format(Math.round(scores.ps / 5))}</span>
                </div>
              </div>
            </div>

            <div style={{ ...card, textAlign: "center" }}>
              <div style={{ ...label, textAlign: "start", fontFamily: "var(--font-latin)" }}>Post Score</div>
              <div style={{ display: "grid", placeItems: "center", marginBlockStart: 8 }}>
                <ScoreRadial value={scores.ps} size={96} color="var(--teal)" />
              </div>
              <p style={{ fontSize: 12.5, color: "var(--muted)", marginBlockStart: 6, lineHeight: 1.6 }}>{t("scoreHint")}</p>
              <button onClick={() => setShowWhy((s) => !s)} aria-expanded={showWhy} style={{ background: "none", border: "none", color: "var(--teal-deep)", fontWeight: 600, fontSize: 12, cursor: "pointer", marginBlockStart: 8 }}>
                {showWhy ? t("whyHide") : t("whyScore")}
              </button>
              {showWhy && (
                <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 6, textAlign: "start" }}>
                  {scoreBreakdown(hook, body).map((f) => (
                    <li key={f.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: f.ok ? "var(--slate)" : "var(--muted)" }}>
                      <span style={{ flex: "none", width: 16, height: 16, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800, background: f.ok ? "var(--teal-tint-2)" : "var(--coral-tint)", color: f.ok ? "var(--teal-deep)" : "var(--coral)" }}>{f.ok ? "✓" : "!"}</span>
                      {t(`why_${f.key}`)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={card}>
              <div style={{ ...label, fontFamily: "var(--font-ar)" }}>{t("dnaMatchTitle")}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBlock: "10px 8px" }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: "var(--teal-deep)", fontFamily: "var(--font-latin)" }}>{scores.dm}%</span>
                <div style={{ flex: 1 }}><ProgressMeter pct={scores.dm} /></div>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>{t("dnaMatchHint")}</p>
            </div>

            <div style={{ ...card, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 9, background: "var(--gold-tint)", color: "var(--gold-dark)" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
              </span>
              <span style={{ fontSize: 13, color: "var(--slate)" }}>{t("bestTime")}: <b style={{ color: "var(--heading)" }}>{ok.bestTime}</b></span>
            </div>

            {!guard.ok && <p style={notice}>{t("guardBlocked", { issues: guard.violations.join(", ") })}</p>}
            <div style={{ display: "flex", gap: 8, opacity: guard.ok ? 1 : 0.5, pointerEvents: guard.ok ? "auto" : "none" }}>
              <button onClick={() => { navigator.clipboard?.writeText(`${hook}\n\n${body}`); setCopied(true); setTimeout(() => setCopied(false), 1400); }} style={{ ...btnGhost, flex: 1, height: 40 }}>{copied ? t("copied") : t("copy")}</button>
              <a href={`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(`${hook}\n\n${body}`)}`} target="_blank" rel="noopener noreferrer" style={{ ...btnGhost, flex: 1, height: 40 }}>{t("shareLinkedin")}</a>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBlockEnd: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBlockEnd: 9 }}>
        <span style={label}>{title}</span>
        {hint && <span style={{ fontSize: 11.5, color: "var(--teal-deep)", fontWeight: 600 }}>{hint}</span>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{children}</div>
    </div>
  );
}
function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: "7px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: on ? "1.5px solid var(--navy)" : "1.5px solid var(--border-2)", background: on ? "var(--teal)" : "var(--card)", color: on ? "#fff" : "var(--slate)" }}>
      {children}
    </button>
  );
}

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 16 };
const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: "var(--heading)" };
const field: React.CSSProperties = { width: "100%", height: 40, padding: "0 10px", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--card)", fontSize: 13, outline: "none" };
const notice: React.CSSProperties = { padding: "11px 14px", borderRadius: 12, background: "var(--coral-tint)", border: "1px solid rgba(224,101,74,.3)", color: "var(--coral)", fontSize: 13.5 };
