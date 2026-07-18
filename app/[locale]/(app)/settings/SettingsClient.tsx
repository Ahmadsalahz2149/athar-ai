"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { updateProfile } from "@/lib/auth/actions";
import { ProgressMeter, btnNavy, btnTeal, btnGhost, btnGold } from "@/components/ui/display";

type Props = {
  email: string;
  fullName: string;
  title: string;
  bio: string;
  balance: number;
  completeness: number;
  sourcesUsed: number;
  sourcesLimit: number;
  brandType: string;
  field: string;
  audience: string;
  dialect: string;
};

const TABS = ["profile", "brand", "platforms", "team", "plan", "notifications"] as const;
const NOTIF = ["analysis", "schedule", "weekly", "marketing"] as const;
const PLATFORMS = [
  { key: "linkedin", glyph: "in", bg: "var(--blue-tint)", fg: "var(--blue)", connected: false },
  { key: "x", glyph: "X", bg: "#EEE", fg: "#111", connected: false },
  { key: "instagram", glyph: "ig", bg: "var(--gold-tint)", fg: "#C2410C", connected: false },
  { key: "tiktok", glyph: "TT", bg: "#EEE", fg: "#111", connected: false },
];

export function SettingsClient(p: Props) {
  const t = useTranslations("Settings");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
  const [tab, setTab] = useState<(typeof TABS)[number]>("profile");

  const [name, setName] = useState(p.fullName);
  const [title, setTitle] = useState(p.title);
  const [bio, setBio] = useState(p.bio);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const save = () =>
    start(async () => {
      const r = await updateProfile({ fullName: name, title, bio });
      setSaved(r.ok);
      setTimeout(() => setSaved(false), 2000);
    });

  const [notif, setNotif] = useState<Record<string, boolean>>(() => {
    const base = { analysis: true, schedule: true, weekly: false, marketing: false };
    if (typeof window === "undefined") return base;
    try {
      const raw = localStorage.getItem("athar-notif");
      return raw ? { ...base, ...JSON.parse(raw) } : base;
    } catch {
      return base;
    }
  });
  const toggle = (k: string) =>
    setNotif((n) => {
      const next = { ...n, [k]: !n[k] };
      try {
        localStorage.setItem("athar-notif", JSON.stringify(next));
      } catch {}
      return next;
    });

  return (
    <div className="settings-grid" style={{ display: "grid", gridTemplateColumns: "190px 1fr", gap: 20, alignItems: "start" }}>
      <nav style={{ display: "flex", flexDirection: "column", gap: 4, position: "sticky", insetBlockStart: 12 }}>
        {TABS.map((tb) => (
          <button key={tb} onClick={() => setTab(tb)} style={{ textAlign: "start", padding: "11px 14px", borderRadius: 11, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, background: tab === tb ? "var(--navy)" : "transparent", color: tab === tb ? "#fff" : "var(--slate)" }}>
            {t(`tab_${tb}`)}
          </button>
        ))}
      </nav>

      <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 22 }}>
        {tab === "profile" && (
          <Panel title={t("tab_profile")}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBlockEnd: 18 }}>
              <span style={{ width: 60, height: 60, borderRadius: "50%", display: "grid", placeItems: "center", background: "linear-gradient(135deg,var(--navy-2),var(--navy))", color: "#fff", fontWeight: 800, fontSize: 22 }}>{(name || p.email || "A")[0].toUpperCase()}</span>
              <div>
                <button style={{ ...btnNavy, height: 38 }}>{t("changePhoto")}</button>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginBlockStart: 7 }}>{t("photoHint")}</div>
              </div>
            </div>
            <div style={{ height: 1, background: "var(--border)", marginBlockEnd: 18 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label={t("name")}><input value={name} onChange={(e) => setName(e.target.value)} style={inp} /></Field>
              <Field label={t("jobTitle")}><input value={title} onChange={(e) => setTitle(e.target.value)} style={inp} /></Field>
            </div>
            <Field label={t("bio")}><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} style={{ ...inp, height: "auto", padding: 12, lineHeight: 1.8, resize: "vertical" }} /></Field>
            <Field label={t("email")}><input value={p.email} disabled style={{ ...inp, opacity: 0.65, direction: "ltr", textAlign: "start" }} /></Field>
            <button onClick={save} disabled={pending} style={{ ...btnTeal, marginBlockStart: 16, opacity: pending ? 0.7 : 1 }}>{saved ? t("savedOk") : t("saveChanges")}</button>
          </Panel>
        )}

        {tab === "brand" && (
          <Panel title={t("tab_brand")} action={<Link href="/dna" style={{ ...btnGhost, height: 38, background: "var(--teal-tint-2)", border: "1px solid rgba(20,184,166,.3)", color: "var(--teal-deep)" }}>{t("openDna")}</Link>}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <ReadTile label={t("brandType")} value={p.brandType || "—"} />
              <ReadTile label={t("brandField")} value={p.field || "—"} />
              <ReadTile label={t("brandAudience")} value={p.audience || "—"} />
              <ReadTile label={t("brandDialect")} value={p.dialect || "—"} />
            </div>
            <div style={{ marginBlockStart: 16, padding: 16, borderRadius: 14, background: "var(--teal-tint-2)", border: "1px solid rgba(20,184,166,.25)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, color: "var(--heading)" }}>{t("completeness", { pct: nf.format(p.completeness) })}</div>
                <div style={{ fontSize: 13, color: "var(--slate-2)", marginBlockStart: 3 }}>{t("completenessHint")}</div>
              </div>
              <Link href="/ingest" style={{ ...btnNavy, height: 40 }}>{t("addSamples")}</Link>
            </div>
          </Panel>
        )}

        {tab === "platforms" && (
          <Panel title={t("platformsTitle")}>
            <p style={{ fontSize: 13.5, color: "var(--muted)", marginBlockEnd: 16 }}>{t("platformsSub")}</p>
            <div style={{ display: "grid", gap: 10 }}>
              {PLATFORMS.map((pl) => (
                <div key={pl.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <span style={{ width: 36, height: 36, flex: "none", borderRadius: 9, display: "grid", placeItems: "center", background: pl.bg, color: pl.fg, fontWeight: 800, fontFamily: "var(--font-latin)", fontSize: 13 }}>{pl.glyph}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "var(--heading)", fontSize: 14 }}>{t(`pf_${pl.key}`)}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBlockStart: 2 }}>{t("notConnected")}</div>
                  </div>
                  <button style={{ ...btnNavy, height: 36, fontSize: 12.5 }}>{t("connect")}</button>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "var(--gold-dark)", marginBlockStart: 12 }}>⚠ {t("oauthNote")}</p>
          </Panel>
        )}

        {tab === "team" && (
          <Panel title={t("tab_team")}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)" }}>
              <span style={{ width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", background: "linear-gradient(135deg,var(--navy-2),var(--navy))", color: "#fff", fontWeight: 800 }}>{(name || "A")[0].toUpperCase()}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "var(--heading)", fontSize: 14 }}>{name || p.email} ({t("you")})</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBlockStart: 2 }}>{t("ownerFull")}</div>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999, background: "var(--teal-tint-2)", color: "var(--teal-deep)" }}>{t("owner")}</span>
            </div>
            <div style={{ marginBlockStart: 16, padding: 22, borderRadius: 14, border: "1px dashed var(--border-2)", textAlign: "center" }}>
              <div style={{ fontWeight: 700, color: "var(--heading)", marginBlockEnd: 6 }}>{t("teamUpsellTitle")}</div>
              <div style={{ fontSize: 13.5, color: "var(--slate-2)", marginBlockEnd: 16, lineHeight: 1.7 }}>{t("teamUpsellBody")}</div>
              <button style={{ ...btnGold, height: 42 }}>{t("upgradeAgency")}</button>
            </div>
          </Panel>
        )}

        {tab === "plan" && (
          <Panel title={t("tab_plan")}>
            <div style={{ padding: 18, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("currentPlan")}</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: "var(--heading)", marginBlockStart: 3 }}>{t("planFree")}</div>
              </div>
              <div style={{ minWidth: 180 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--slate)", marginBlockEnd: 6 }}>
                  <span>{t("knowledgeFiles")}</span>
                  <span style={{ fontFamily: "var(--font-latin)", fontWeight: 700 }}>{nf.format(p.sourcesUsed)} / {nf.format(p.sourcesLimit)}</span>
                </div>
                <ProgressMeter pct={(p.sourcesUsed / Math.max(1, p.sourcesLimit)) * 100} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBlockStart: 16 }}>
              <PlanCard name={t("planPro")} price="99" unit={t("perMonth")} feats={t("featPro")} cta={<button style={{ ...btnNavy, width: "100%" }}>{t("upgrade")}</button>} />
              <PlanCard name={t("planAgency")} price="299" unit={t("perMonth")} feats={t("featAgency")} highlight cta={<button style={{ ...btnTeal, width: "100%" }}>{t("upgrade")}</button>} />
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBlockStart: 12 }}>{t("billingNote")}</p>
          </Panel>
        )}

        {tab === "notifications" && (
          <Panel title={t("tab_notifications")}>
            {NOTIF.map((k, i) => (
              <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 0", borderBlockEnd: i < NOTIF.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--heading)" }}>{t(`ntitle_${k}`)}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginBlockStart: 2 }}>{t(`ndesc_${k}`)}</div>
                </div>
                <button onClick={() => toggle(k)} aria-label={k} style={{ width: 46, height: 26, flex: "none", borderRadius: 999, border: "none", cursor: "pointer", background: notif[k] ? "var(--teal)" : "var(--border-2)", position: "relative" }}>
                  <span style={{ position: "absolute", insetBlockStart: 3, insetInlineStart: notif[k] ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "inset-inline-start .15s" }} />
                </button>
              </div>
            ))}
          </Panel>
        )}
      </section>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBlockEnd: 18 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--heading)" }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBlockStart: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--slate)", marginBlockEnd: 7 }}>{label}</div>
      {children}
    </div>
  );
}
function ReadTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--heading)", marginBlockStart: 4 }}>{value}</div>
    </div>
  );
}
function PlanCard({ name, price, unit, feats, cta, highlight }: { name: string; price: string; unit: string; feats: string; cta: React.ReactNode; highlight?: boolean }) {
  return (
    <div style={{ border: highlight ? "1.5px solid var(--teal)" : "1px solid var(--border-2)", background: highlight ? "var(--teal-tint-2)" : "var(--card)", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontWeight: 700, color: "var(--heading)" }}>{name}</div>
      <div><span style={{ fontSize: 24, fontWeight: 800, color: "var(--teal-deep)", fontFamily: "var(--font-latin)" }}>{price}</span> <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{unit}</span></div>
      <div style={{ fontSize: 12.5, color: "var(--slate-2)", lineHeight: 1.7, flex: 1 }}>{feats}</div>
      {cta}
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%",
  height: 44,
  padding: "0 13px",
  borderRadius: 11,
  border: "1px solid var(--border-2)",
  background: "var(--card)",
  fontSize: 14,
  outline: "none",
};
