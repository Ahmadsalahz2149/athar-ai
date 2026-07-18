"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { scheduleDraft, autoScheduleApproved } from "./actions";
import { CountBadge, btnGhost } from "@/components/ui/display";

type Item = { id: string; hook: string };
type Labels = {
  unscheduled: string; none: string; scheduleBtn: string; confirm: string; cancel: string;
  autoAll: string; scheduling: string; pickWhen: string; autoDone: string; error: string;
};

export function Scheduler({ items, labels, defaultWhen }: { items: Item[]; labels: Labels; defaultWhen: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [when, setWhen] = useState(defaultWhen);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const doSchedule = (id: string) => {
    setErr(null);
    start(async () => {
      const r = await scheduleDraft(id, new Date(when).toISOString());
      if (!r.ok) return setErr(labels.error);
      setOpenId(null);
      router.refresh();
    });
  };

  const doAuto = () => {
    setErr(null); setMsg(null);
    start(async () => {
      const r = await autoScheduleApproved(new Date(defaultWhen).toISOString());
      if (!r.ok) return setErr(labels.error);
      setMsg(labels.autoDone.replace("{n}", String(r.scheduled)));
      router.refresh();
    });
  };

  return (
    <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBlockEnd: 12 }}>
        <span style={{ fontWeight: 700, color: "var(--heading)", fontSize: 15 }}>{labels.unscheduled}</span>
        {items.length > 0 && <CountBadge n={items.length} />}
      </div>

      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--muted)" }}>{labels.none}</p>
      ) : (
        <>
          <button onClick={doAuto} disabled={pending} style={{ ...btnGhost, width: "100%", height: 38, marginBlockEnd: 12, fontSize: 12.5, background: "var(--teal-tint-2)", border: "1px solid rgba(20,184,166,.3)", color: "var(--teal-deep)", opacity: pending ? 0.6 : 1 }}>
            ✦ {pending ? labels.scheduling : labels.autoAll}
          </button>
          {msg && <p style={{ fontSize: 12.5, color: "var(--teal-deep)", fontWeight: 600, marginBlockEnd: 10 }}>{msg}</p>}
          <div style={{ display: "grid", gap: 10 }}>
            {items.slice(0, 6).map((u) => (
              <div key={u.id} style={{ padding: "11px 13px", borderRadius: 11, background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--heading)", marginBlockEnd: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{u.hook}</div>
                {openId === u.id ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ fontSize: 11.5, color: "var(--muted)" }}>{labels.pickWhen}</label>
                    <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={{ width: "100%", height: 38, padding: "0 10px", borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--card)", fontSize: 13, fontFamily: "var(--font-latin)" }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => doSchedule(u.id)} disabled={pending} style={{ flex: 1, padding: "7px 0", borderRadius: 9, border: "none", background: "var(--navy)", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer", opacity: pending ? 0.6 : 1 }}>{labels.confirm}</button>
                      <button onClick={() => setOpenId(null)} disabled={pending} style={{ padding: "7px 12px", borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--card)", fontSize: 12.5, color: "var(--muted)", cursor: "pointer" }}>{labels.cancel}</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setOpenId(u.id); setErr(null); }} style={{ display: "block", width: "100%", textAlign: "center", padding: "7px 0", borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--card)", fontSize: 12.5, fontWeight: 600, color: "var(--navy)", cursor: "pointer" }}>{labels.scheduleBtn}</button>
                )}
              </div>
            ))}
          </div>
          {err && <p style={{ fontSize: 12.5, color: "var(--coral)", marginBlockStart: 10 }}>{err}</p>}
        </>
      )}
    </section>
  );
}
