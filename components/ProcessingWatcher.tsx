"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * Live-status watcher (INFRA phase 3). Mounted by a server page only when it has
 * work in flight. Polls the given server action; refreshes the route while jobs
 * are active (so progress/status update in place), does one final refresh when
 * the queue drains, then stops. Zero UI.
 */
export function ProcessingWatcher({ poll, intervalMs = 3000 }: { poll: () => Promise<number>; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let stopped = false;
    let handle: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (stopped) return;
      let active = 0;
      try { active = await poll(); } catch { /* transient — try again */ }
      if (stopped) return;
      router.refresh();
      if (active > 0) handle = setTimeout(tick, intervalMs); // keep watching
      // active === 0 → we just did the final refresh; stop.
    };
    handle = setTimeout(tick, intervalMs);
    return () => { stopped = true; clearTimeout(handle); };
  }, [poll, router, intervalMs]);
  return null;
}
