"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { retryJob } from "./actions";

/** Retry a failed operation from the Creation Center. */
export function RetryButton({ jobId }: { jobId: string }) {
  const t = useTranslations("Activity");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => { await retryJob(jobId); router.refresh(); })}
      disabled={pending}
      style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid var(--teal)", background: "transparent", color: "var(--teal-deep)", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
    >
      {pending ? t("retrying") : t("retry")}
    </button>
  );
}
