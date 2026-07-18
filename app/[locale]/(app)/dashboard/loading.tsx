import { Skeleton } from "@/components/ui/display";

/** Streaming fallback while the dashboard's data resolves. Mirrors the real
 * layout so the shell doesn't jump when content arrives. */
export default function DashboardLoading() {
  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "clamp(20px,3.4vw,32px) clamp(16px,4vw,32px) 90px" }} aria-busy="true">
      <Skeleton h={30} w={260} />
      <div style={{ marginBlockStart: 8 }}><Skeleton h={16} w={200} /></div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(168px,1fr))", gap: 14, marginBlockStart: 22 }}>
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} h={92} r={16} />)}
      </div>

      {/* Recommendation hero */}
      <div style={{ marginBlockStart: 20 }}><Skeleton h={150} r={18} /></div>

      {/* Two columns */}
      <div className="col2 wide-first" style={{ marginBlockStart: 20 }}>
        <div style={{ display: "grid", gap: 20 }}>
          <Skeleton h={140} r={16} />
          <Skeleton h={200} r={16} />
        </div>
        <div style={{ display: "grid", gap: 20 }}>
          <Skeleton h={180} r={16} />
          <Skeleton h={160} r={16} />
        </div>
      </div>
    </main>
  );
}
