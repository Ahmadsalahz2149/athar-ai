import postgres from "postgres";

const jobId = process.argv[2];
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId || "")) {
  throw new Error("Usage: node scripts/requeue-dead-ingest.mjs <job-uuid>");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const result = await sql.begin(async (tx) => {
    const jobs = await tx`
      UPDATE jobs
      SET status = 'queued', attempts = 0, run_after = now(),
          locked_at = null, locked_by = null, last_error = null, updated_at = now()
      WHERE id = ${jobId}::uuid AND type = 'ingest_source' AND status = 'dead'
      RETURNING id, brand_id, payload
    `;
    if (jobs.length !== 1) throw new Error("Dead ingest job not found");

    const sourceId = jobs[0].payload?.sourceId;
    if (typeof sourceId !== "string") throw new Error("Job payload has no sourceId");
    await tx`
      UPDATE sources
      SET status = 'processing'
      WHERE id = ${sourceId}::uuid AND brand_id = ${jobs[0].brand_id}
    `;
    return { jobId: jobs[0].id, sourceId, status: "queued" };
  });
  console.log(JSON.stringify(result));
} finally {
  await sql.end();
}
