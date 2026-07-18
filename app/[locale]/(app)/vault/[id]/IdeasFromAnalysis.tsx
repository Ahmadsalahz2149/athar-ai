"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ideasFromAnalysis } from "../actions";
import { btnGhost } from "@/components/ui/display";

export function IdeasFromAnalysis({ sourceId }: { sourceId: string }) {
  const t = useTranslations("Analysis");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <button
      onClick={() =>
        start(async () => {
          const r = await ideasFromAnalysis(sourceId);
          if (r.ok) {
            setDone(true);
            router.refresh();
          }
        })
      }
      disabled={pending || done}
      style={{ ...btnGhost, height: 34, fontSize: 12.5, background: "var(--teal-tint-2)", border: "1px solid rgba(20,184,166,.3)", color: "var(--teal-deep)" }}
    >
      {done ? t("addedToIdeas") : pending ? t("adding") : `+ ${t("addAllToIdeas")}`}
    </button>
  );
}
