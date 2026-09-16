"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { btnNavy } from "@/components/ui/display";
import { acceptInvite } from "./actions";

/** The accept button. Kept client-side so a failure can be explained in place
 * — a redirect to a generic error page tells the person nothing about whether
 * to ask for a new link or sign in with a different address. */
export function AcceptInvite({ token }: { token: string }) {
  const t = useTranslations("Invite");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  const accept = () =>
    start(async () => {
      setErr("");
      const r = await acceptInvite(token);
      if (!r.ok) { setErr(t(`err_${r.error}`)); return; }
      router.push("/dashboard");
      router.refresh();
    });

  return (
    <div>
      <button onClick={accept} disabled={pending} style={{ ...btnNavy, width: "100%", opacity: pending ? 0.7 : 1 }}>
        {pending ? t("joining") : t("join")}
      </button>
      {err && <div style={{ marginBlockStart: 12, fontSize: 13.5, color: "var(--coral)", lineHeight: 1.8 }}>{err}</div>}
    </div>
  );
}
