"use client";

import { useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { GlyphIcon, btnNavy, btnTeal, btnGhost } from "@/components/ui/display";
import type { BrandProfile } from "@/lib/brand/profile";
import { saveBrandProfile, saveProduct, deleteProduct, uploadLogo, createBrand, renameBrand, switchBrand } from "./actions";

export type BrandProductView = {
  id: string;
  name: string;
  kind: string;
  description: string | null;
  price: string | null;
  url: string | null;
};

export type BrandData = {
  brandId: string;
  name: string;
  logoUrl: string | null;
  profile: BrandProfile;
  products: BrandProductView[];
  brands: { id: string; name: string; logoUrl: string | null }[];
};

const cardStyle: CSSProperties = {
  background: "var(--surface, #fff)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: "clamp(16px,2.4vw,22px)",
  marginBlockEnd: 16,
};
const labelStyle: CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "var(--heading)", marginBlockEnd: 6, display: "block" };
const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--bg, #fff)",
  fontSize: 14,
  color: "var(--heading)",
  fontFamily: "inherit",
};

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

export function BrandClient({ data }: { data: BrandData }) {
  const t = useTranslations("BrandKit");
  const router = useRouter();

  return (
    <div>
      <BrandsSection data={data} t={t} router={router} />
      <LogoSection data={data} t={t} router={router} />
      <ProfileSection profile={data.profile} t={t} />
      <ProductsSection products={data.products} t={t} router={router} />
    </div>
  );
}

/* ---------- Multi-brand (#15) ---------- */
function BrandsSection({ data, t, router }: { data: BrandData; t: ReturnType<typeof useTranslations>; router: ReturnType<typeof useRouter> }) {
  const [pending, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const doSwitch = (id: string) => start(async () => { await switchBrand(id); router.refresh(); });
  const doCreate = () =>
    start(async () => {
      const r = await createBrand(newName.trim() || t("newBrand"));
      if (r.ok) { setCreating(false); setNewName(""); router.refresh(); }
    });
  const doRename = (id: string) =>
    start(async () => {
      const r = await renameBrand(id, editName);
      if (r.ok) { setEditId(null); router.refresh(); }
    });

  return (
    <Section
      glyph="briefcase"
      title={t("brandsTitle")}
      desc={t("brandsDesc")}
      action={
        !creating ? (
          <button onClick={() => setCreating(true)} style={{ ...btnGhost, height: 34, fontSize: 12.5 }}>+ {t("addBrand")}</button>
        ) : null
      }
    >
      {creating && (
        <div style={{ display: "flex", gap: 8, marginBlockEnd: 12 }}>
          <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("brandNamePlaceholder")} style={inputStyle} />
          <button onClick={doCreate} disabled={pending} style={{ ...btnTeal, height: 40, whiteSpace: "nowrap" }}>{t("create")}</button>
          <button onClick={() => setCreating(false)} style={{ ...btnGhost, height: 40 }}>{t("cancel")}</button>
        </div>
      )}
      <div style={{ display: "grid", gap: 8 }}>
        {data.brands.map((b) => {
          const active = b.id === data.brandId;
          return (
            <div
              key={b.id}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12,
                border: `1px solid ${active ? "var(--teal)" : "var(--border)"}`,
                background: active ? "var(--teal-tint,#e6f7f4)" : "transparent",
              }}
            >
              <LogoThumb url={b.logoUrl} name={b.name} size={34} />
              {editId === b.id ? (
                <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              ) : (
                <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: "var(--heading)" }}>{b.name}</span>
              )}
              {active && editId !== b.id && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--teal)", padding: "2px 8px", borderRadius: 999, background: "#fff", border: "1px solid var(--teal)" }}>
                  {t("active")}
                </span>
              )}
              {editId === b.id ? (
                <>
                  <button onClick={() => doRename(b.id)} disabled={pending} style={{ ...btnTeal, height: 32, fontSize: 12 }}>{t("save")}</button>
                  <button onClick={() => setEditId(null)} style={{ ...btnGhost, height: 32, fontSize: 12 }}>{t("cancel")}</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditId(b.id); setEditName(b.name); }} style={{ ...btnGhost, height: 32, fontSize: 12 }}>{t("rename")}</button>
                  {!active && <button onClick={() => doSwitch(b.id)} disabled={pending} style={{ ...btnNavy, height: 32, fontSize: 12 }}>{t("switch")}</button>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function LogoThumb({ url, name, size }: { url: string | null; name: string; size: number }) {
  // Logos are stored inline as data URIs — next/image can't optimize those.
  // eslint-disable-next-line @next/next/no-img-element
  if (url) return <img src={url} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: 9, objectFit: "cover", border: "1px solid var(--border)" }} />;
  const initial = (name || "؟").trim().charAt(0);
  return (
    <span style={{ width: size, height: size, borderRadius: 9, display: "grid", placeItems: "center", background: "var(--navy,#273343)", color: "#fff", fontWeight: 700, fontSize: size * 0.42 }}>
      {initial}
    </span>
  );
}

/* ---------- Logo / visual identity (#4) ---------- */
function LogoSection({ data, t, router }: { data: BrandData; t: ReturnType<typeof useTranslations>; router: ReturnType<typeof useRouter> }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (file: File | null) => {
    setErr("");
    if (!file) return;
    const form = new FormData();
    form.set("logo", file);
    start(async () => {
      const r = await uploadLogo(form);
      if (!r.ok) setErr(r.error === "bad_type" ? t("logoErrType") : r.error === "too_large" ? t("logoErrSize") : t("logoErrGeneric"));
      else router.refresh();
    });
  };
  const clear = () => start(async () => { await uploadLogo(new FormData()); router.refresh(); });

  return (
    <Section glyph="trophy" title={t("logoTitle")} desc={t("logoDesc")}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <LogoThumb url={data.logoUrl} name={data.name} size={72} />
        <div style={{ display: "flex", gap: 8 }}>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" hidden onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          <button onClick={() => fileRef.current?.click()} disabled={pending} style={{ ...btnNavy, height: 38 }}>{pending ? t("uploading") : t("chooseLogo")}</button>
          {data.logoUrl && <button onClick={clear} disabled={pending} style={{ ...btnGhost, height: 38 }}>{t("removeLogo")}</button>}
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBlockStart: 10 }}>{t("logoHint")}</div>
      {err && <div style={{ fontSize: 12.5, color: "var(--danger,#dc2626)", marginBlockStart: 8 }}>{err}</div>}
    </Section>
  );
}

/* ---------- Profile: descriptions, team, constraints, production, Q&A ---------- */
const TEAM_SIZES = ["solo", "small", "medium", "agency"] as const;

function ProfileSection({ profile, t }: { profile: BrandProfile; t: ReturnType<typeof useTranslations> }) {
  const [p, setP] = useState<BrandProfile>(profile);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof BrandProfile>(k: K, v: BrandProfile[K]) => setP((prev) => ({ ...prev, [k]: v }));

  const [constraintInput, setConstraintInput] = useState("");
  const addConstraint = () => {
    const v = constraintInput.trim();
    if (v && !p.constraints.includes(v)) set("constraints", [...p.constraints, v].slice(0, 20));
    setConstraintInput("");
  };
  const removeConstraint = (i: number) => set("constraints", p.constraints.filter((_, idx) => idx !== i));

  const setQa = (i: number, field: "q" | "a", v: string) => set("qa", p.qa.map((qa, idx) => (idx === i ? { ...qa, [field]: v } : qa)));
  const addQa = () => set("qa", [...p.qa, { q: "", a: "" }].slice(0, 20));
  const removeQa = (i: number) => set("qa", p.qa.filter((_, idx) => idx !== i));

  const save = () =>
    start(async () => {
      const r = await saveBrandProfile(p);
      setSaved(r.ok);
      setTimeout(() => setSaved(false), 2200);
    });

  return (
    <>
      {/* Descriptions #13 */}
      <Section glyph="bookOpen" title={t("descTitle")} desc={t("descDesc")}>
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={labelStyle}>{t("descShort")}</label>
            <input value={p.descShort} onChange={(e) => set("descShort", e.target.value)} placeholder={t("descShortPh")} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t("descDetailed")}</label>
            <textarea value={p.descDetailed} onChange={(e) => set("descDetailed", e.target.value)} placeholder={t("descDetailedPh")} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div>
            <label style={labelStyle}>{t("descTechnical")}</label>
            <textarea value={p.descTechnical} onChange={(e) => set("descTechnical", e.target.value)} placeholder={t("descTechnicalPh")} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
        </div>
      </Section>

      {/* Team size #12 */}
      <Section glyph="briefcase" title={t("teamTitle")} desc={t("teamDesc")}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TEAM_SIZES.map((s) => {
            const active = p.teamSize === s;
            return (
              <button
                key={s}
                onClick={() => set("teamSize", active ? "" : s)}
                style={{
                  padding: "9px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${active ? "var(--teal)" : "var(--border)"}`,
                  background: active ? "var(--teal)" : "transparent",
                  color: active ? "#fff" : "var(--heading)",
                }}
              >
                {t(`team_${s}`)}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Content constraints #10 */}
      <Section glyph="warn" title={t("constraintsTitle")} desc={t("constraintsDesc")}>
        <div style={{ display: "flex", gap: 8, marginBlockEnd: 12 }}>
          <input
            value={constraintInput}
            onChange={(e) => setConstraintInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addConstraint(); } }}
            placeholder={t("constraintPh")}
            style={inputStyle}
          />
          <button onClick={addConstraint} style={{ ...btnTeal, height: 40, whiteSpace: "nowrap" }}>{t("add")}</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {p.constraints.length === 0 && <span style={{ fontSize: 12.8, color: "var(--muted)" }}>{t("constraintsEmpty")}</span>}
          {p.constraints.map((c, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "var(--gold-tint,#fdf3d9)", color: "var(--gold-dark)", fontSize: 12.8, fontWeight: 600 }}>
              {c}
              <button onClick={() => removeConstraint(i)} aria-label={t("remove")} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
            </span>
          ))}
        </div>
      </Section>

      {/* Production guidelines #11 */}
      <Section glyph="bulb" title={t("productionTitle")} desc={t("productionDesc")}>
        <textarea value={p.productionNotes} onChange={(e) => set("productionNotes", e.target.value)} placeholder={t("productionPh")} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
      </Section>

      {/* Identity Q&A #14 */}
      <Section
        glyph="message"
        title={t("qaTitle")}
        desc={t("qaDesc")}
        action={<button onClick={addQa} style={{ ...btnGhost, height: 34, fontSize: 12.5 }}>+ {t("addQa")}</button>}
      >
        {p.qa.length === 0 && <div style={{ fontSize: 12.8, color: "var(--muted)" }}>{t("qaEmpty")}</div>}
        <div style={{ display: "grid", gap: 12 }}>
          {p.qa.map((qa, i) => (
            <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBlockEnd: 8 }}>
                <input value={qa.q} onChange={(e) => setQa(i, "q", e.target.value)} placeholder={t("qaQPh")} style={{ ...inputStyle, fontWeight: 600 }} />
                <button onClick={() => removeQa(i)} aria-label={t("remove")} style={{ ...btnGhost, height: 40, width: 40, flexShrink: 0 }}>×</button>
              </div>
              <textarea value={qa.a} onChange={(e) => setQa(i, "a", e.target.value)} placeholder={t("qaAPh")} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
          ))}
        </div>
      </Section>

      {/* Single save for all profile fields */}
      <div style={{ position: "sticky", insetBlockEnd: 12, display: "flex", justifyContent: "flex-end", gap: 10, marginBlockStart: 4 }}>
        {saved && <span style={{ alignSelf: "center", fontSize: 13, fontWeight: 600, color: "var(--teal)" }}>{t("savedProfile")}</span>}
        <button onClick={save} disabled={pending} className="glass-bar" style={{ ...btnTeal, height: 46, paddingInline: 28, fontSize: 14.5, boxShadow: "0 6px 20px rgba(15, 118, 110,.28)" }}>
          {pending ? t("saving") : t("saveProfile")}
        </button>
      </div>
    </>
  );
}

/* ---------- Products & services (#9) ---------- */
type Draft = { id?: string; name: string; kind: string; description: string; price: string; url: string };
const EMPTY_DRAFT: Draft = { name: "", kind: "product", description: "", price: "", url: "" };

function ProductsSection({ products, t, router }: { products: BrandProductView[]; t: ReturnType<typeof useTranslations>; router: ReturnType<typeof useRouter> }) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);

  const edit = (p: BrandProductView) => setDraft({ id: p.id, name: p.name, kind: p.kind, description: p.description ?? "", price: p.price ?? "", url: p.url ?? "" });
  const save = () =>
    draft &&
    start(async () => {
      const r = await saveProduct(draft);
      if (r.ok) { setDraft(null); router.refresh(); }
    });
  const remove = (id: string) => start(async () => { await deleteProduct(id); router.refresh(); });

  return (
    <Section
      glyph="chart"
      title={t("productsTitle")}
      desc={t("productsDesc")}
      action={!draft ? <button onClick={() => setDraft({ ...EMPTY_DRAFT })} style={{ ...btnGhost, height: 34, fontSize: 12.5 }}>+ {t("addProduct")}</button> : null}
    >
      {draft && (
        <div style={{ border: "1px solid var(--teal)", borderRadius: 12, padding: 14, marginBlockEnd: 14, background: "var(--teal-tint,#e6f7f4)" }}>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {(["product", "service"] as const).map((k) => (
                <button key={k} onClick={() => setDraft({ ...draft, kind: k })} style={{ padding: "7px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${draft.kind === k ? "var(--teal)" : "var(--border)"}`, background: draft.kind === k ? "var(--teal)" : "#fff", color: draft.kind === k ? "#fff" : "var(--heading)" }}>
                  {t(`kind_${k}`)}
                </button>
              ))}
            </div>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t("productNamePh")} style={inputStyle} />
            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder={t("productDescPh")} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder={t("productPricePh")} style={inputStyle} />
              <input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder={t("productUrlPh")} style={inputStyle} dir="ltr" />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDraft(null)} style={{ ...btnGhost, height: 38 }}>{t("cancel")}</button>
              <button onClick={save} disabled={pending || !draft.name.trim()} style={{ ...btnTeal, height: 38 }}>{pending ? t("saving") : t("save")}</button>
            </div>
          </div>
        </div>
      )}
      {products.length === 0 && !draft && <div style={{ fontSize: 12.8, color: "var(--muted)" }}>{t("productsEmpty")}</div>}
      <div style={{ display: "grid", gap: 8 }}>
        {products.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: "var(--heading)" }}>{p.name}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--teal-tint,#e6f7f4)", color: "var(--teal)" }}>{t(`kind_${p.kind === "service" ? "service" : "product"}`)}</span>
                {p.price && <span style={{ fontSize: 12, color: "var(--gold-dark)", fontWeight: 600 }}>{p.price}</span>}
              </div>
              {p.description && <div style={{ fontSize: 12.5, color: "var(--muted)", marginBlockStart: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</div>}
            </div>
            <button onClick={() => edit(p)} style={{ ...btnGhost, height: 32, fontSize: 12 }}>{t("editBtn")}</button>
            <button onClick={() => remove(p.id)} disabled={pending} style={{ ...btnGhost, height: 32, fontSize: 12, color: "var(--danger,#dc2626)" }}>{t("delete")}</button>
          </div>
        ))}
      </div>
    </Section>
  );
}
