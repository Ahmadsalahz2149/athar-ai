"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { btnNavy, btnGhost } from "@/components/ui/display";
import { INVITABLE_ROLES } from "@/lib/auth/roles";
import { changeMemberRole, inviteMember, removeMember, revokeInvite, teamView, type Invite, type Member } from "./team-actions";

/**
 * The team screen (Phase 4).
 *
 * Two things it deliberately does NOT do. It does not pretend to send an email:
 * outbound mail is not configured, and an invitation that silently fails to
 * arrive is worse than none, so it hands the owner a link to send themselves
 * and says so. And it does not offer controls a role cannot use — a workspace
 * where the buttons are visible but always refuse teaches people the product is
 * broken rather than that they lack a permission.
 */
export function TeamSection() {
  const t = useTranslations("Team");
  const [view, setView] = useState<{ role: string; members: Member[]; invites: Invite[] } | null>(null);
  const [err, setErr] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("editor");
  const [link, setLink] = useState<{ url: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const load = () =>
    start(async () => {
      const r = await teamView();
      if (r.ok) setView({ role: r.role, members: r.members, invites: r.invites });
      else setErr(t("errLoad"));
    });

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!view) return null;
  const canManage = view.role === "owner";

  const invite = () =>
    start(async () => {
      setErr("");
      setLink(null);
      setCopied(false);
      const r = await inviteMember(email, role, window.location.origin);
      if (!r.ok) { setErr(t(`err_${r.error}`)); return; }
      setLink({ url: r.url, email: r.email });
      setEmail("");
      load();
    });

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setErr("");
      const r = await fn();
      if (!r.ok) { setErr(t("errGeneric")); return; }
      load();
    });

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      setCopied(false); // a blocked clipboard is not an error worth a banner; the field is selectable
    }
  };

  const pendingInvites = view.invites.filter((i) => i.state === "pending");

  return (
    <section style={{ marginBlockStart: 20, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
      <div style={{ fontWeight: 700, color: "var(--heading)", fontSize: 15 }}>{t("title")}</div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBlock: "6px 16px", lineHeight: 1.85 }}>{t("subtitle")}</p>

      {/* Seats */}
      <div style={{ display: "grid", gap: 10 }}>
        {view.members.map((m) => (
          <div key={m.userId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--heading)" }}>
                {m.email ?? t("unknownMember")}{m.you ? ` — ${t("you")}` : ""}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginBlockStart: 4 }}>{t(`role_${m.role}`)} · {t(`roleWhat_${m.role}`)}</div>
            </div>
            {m.manageable && canManage && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select
                  value={m.role}
                  disabled={pending}
                  onChange={(e) => act(() => changeMemberRole(m.userId, e.target.value))}
                  style={{ ...btnGhost, height: 34, fontSize: 13, paddingInline: 10 }}
                >
                  {INVITABLE_ROLES.map((r) => <option key={r} value={r}>{t(`role_${r}`)}</option>)}
                </select>
                <button onClick={() => act(() => removeMember(m.userId))} disabled={pending} style={{ ...btnGhost, height: 34, fontSize: 13, color: "var(--coral)" }}>
                  {t("remove")}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pending invitations */}
      {pendingInvites.length > 0 && (
        <div style={{ marginBlockStart: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--heading)", marginBlockEnd: 8 }}>{t("pendingTitle")}</div>
          <div style={{ display: "grid", gap: 8 }}>
            {pendingInvites.map((i) => (
              <div key={i.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "10px 13px", borderRadius: 11, background: "var(--surface)", border: "1px solid var(--border-2)" }}>
                <span style={{ fontSize: 13.5, color: "var(--slate)" }}>{i.email} · {t(`role_${i.role}`)}</span>
                {canManage && (
                  <button onClick={() => act(() => revokeInvite(i.id))} disabled={pending} style={{ ...btnGhost, height: 32, fontSize: 12.5 }}>{t("revoke")}</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite */}
      {canManage && (
        <div style={{ marginBlockStart: 18, paddingBlockStart: 16, borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--heading)" }}>{t("inviteTitle")}</div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", marginBlock: "5px 12px", lineHeight: 1.8 }}>{t("inviteHint")}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              style={{ flex: "1 1 220px", height: 40, borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--card)", color: "var(--heading)", paddingInline: 12, fontSize: 14 }}
            />
            <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...btnGhost, height: 40, fontSize: 13.5, paddingInline: 10 }}>
              {INVITABLE_ROLES.map((r) => <option key={r} value={r}>{t(`role_${r}`)}</option>)}
            </select>
            <button onClick={invite} disabled={pending || !email.trim()} style={{ ...btnNavy, height: 40, opacity: pending || !email.trim() ? 0.6 : 1 }}>
              {t("invite")}
            </button>
          </div>

          {link && (
            <div style={{ marginBlockStart: 12, padding: "12px 14px", borderRadius: 12, background: "var(--teal-tint-2)", border: "1px solid rgba(15,118,110,.25)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--teal-deep)" }}>{t("linkReady", { email: link.email })}</div>
              <p style={{ fontSize: 12.5, color: "var(--slate)", marginBlock: "5px 9px", lineHeight: 1.8 }}>{t("linkHint")}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  readOnly
                  value={link.url}
                  onFocus={(e) => e.currentTarget.select()}
                  style={{ flex: "1 1 240px", height: 36, borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--card)", color: "var(--slate)", paddingInline: 10, fontSize: 12.5, direction: "ltr", fontFamily: "var(--font-latin)" }}
                />
                <button onClick={copy} style={{ ...btnGhost, height: 36, fontSize: 13 }}>{copied ? t("copied") : t("copy")}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {err && <div style={{ marginBlockStart: 12, fontSize: 13, color: "var(--coral)" }}>{err}</div>}
    </section>
  );
}
