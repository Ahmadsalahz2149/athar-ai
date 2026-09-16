import { Skeleton } from "@/components/ui/display";

/**
 * The fallback a data-backed screen shows while its query resolves.
 *
 * Twelve screens in the app hit the database on the server and had no loading
 * state, so Next.js kept the PREVIOUS page on screen until the new one was
 * ready. To the person clicking, that is indistinguishable from a click that
 * did nothing — and the usual reaction is to click again.
 *
 * Deliberately generic: a shared skeleton in the shape every screen shares
 * (title, subtitle, a grid of cards) beats twelve bespoke ones that drift from
 * their layouts. Where a screen's shape is distinctive enough to be worth it —
 * the dashboard, analytics, the calendar — it keeps its own.
 *
 * `aria-busy` so a screen reader announces the wait instead of reading a page
 * of empty boxes.
 */
export function PageLoading({ maxWidth = 1040, cards = 4 }: { maxWidth?: number; cards?: number }) {
  return (
    <main style={{ maxWidth, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px" }} aria-busy="true">
      <Skeleton h={30} w={240} />
      <div style={{ marginBlockStart: 8 }}><Skeleton h={16} w={320} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 16, marginBlockStart: 24 }}>
        {Array.from({ length: cards }, (_, i) => <Skeleton key={i} h={140} r={16} />)}
      </div>
      <div style={{ marginBlockStart: 20 }}><Skeleton h={220} r={18} /></div>
    </main>
  );
}
