import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { forOrg } from "@/lib/db/forOrg";
import { chunkArabic } from "@/lib/ai/chunk";
import { embed } from "@/lib/ai/embed";

// vitest doesn't auto-load .env.local — pull the keys we need out of it.
function loadEnv(key: string): string | null {
  const p = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const i = s.indexOf("=");
      if (i > 0 && s.slice(0, i).trim() === key) return s.slice(i + 1).trim();
    }
  }
  return process.env[key] ?? null;
}

const DATABASE_URL = loadEnv("DATABASE_URL");
if (!process.env.VOYAGE_API_KEY) {
  const k = loadEnv("VOYAGE_API_KEY");
  if (k) process.env.VOYAGE_API_KEY = k;
}
const canRun = !!DATABASE_URL && !!process.env.VOYAGE_API_KEY;

const sql = DATABASE_URL
  ? postgres(DATABASE_URL, { ssl: { rejectUnauthorized: false }, prepare: false, max: 2 })
  : null;
const db = sql ? drizzle(sql, { schema }) : null;

const DOCS_A = [
  { title: "قهوة", text: "القهوة العربية جزء أصيل من الضيافة في الخليج، تُقدَّم بالهيل في دلّة نحاسية وتُصبّ في فناجين صغيرة كرمزٍ للكرم." },
  { title: "برمجة", text: "تعلّم البرمجة يبدأ بفهم المنطق والخوارزميات ثم إتقان لغة مثل بايثون، والممارسة اليومية أهمّ من حفظ الأوامر." },
];
const DOC_B = { title: "سر", text: "محتوى سري خاص بالمؤسسة ب عن استراتيجية التسويق الرقمي وحملاتها القادمة." };

let orgA = "", orgB = "", brandA = "", brandB = "";
let qCoffee: number[] = [], qSecret: number[] = [];

describe.runIf(canRun)("retrieval (pgvector + Voyage)", () => {
  beforeAll(async () => {
    const [oa] = await db!.insert(schema.organizations).values({ name: "ret-A" }).returning();
    const [ob] = await db!.insert(schema.organizations).values({ name: "ret-B" }).returning();
    orgA = oa.id;
    orgB = ob.id;
    const [ba] = await db!.insert(schema.brands).values({ orgId: orgA, name: "A" }).returning();
    const [bb] = await db!.insert(schema.brands).values({ orgId: orgB, name: "B" }).returning();
    brandA = ba.id;
    brandB = bb.id;

    // Chunk everything, then embed ALL document chunks in a SINGLE request (the
    // free Voyage tier is 3 RPM — keep the whole suite to 2 requests).
    const aDocs = DOCS_A.map((d) => ({ ...d, chunks: chunkArabic(d.text) }));
    const bDoc = { ...DOC_B, chunks: chunkArabic(DOC_B.text) };
    const allTexts = [
      ...aDocs.flatMap((d) => d.chunks.map((c) => c.content)),
      ...bDoc.chunks.map((c) => c.content),
    ];
    const vecs = await embed(allTexts, "document");

    let cur = 0;
    const A = forOrg(db!, orgA);
    for (const d of aDocs) {
      const sid = await A.saveSource(brandA, { title: d.title });
      await A.saveChunks(
        brandA,
        sid,
        d.chunks.map((c, i) => ({ idx: c.idx, content: c.content, embedding: vecs[cur + i] })),
      );
      cur += d.chunks.length;
    }
    const B = forOrg(db!, orgB);
    const sidB = await B.saveSource(brandB, { title: bDoc.title });
    await B.saveChunks(
      brandB,
      sidB,
      bDoc.chunks.map((c, i) => ({ idx: c.idx, content: c.content, embedding: vecs[cur + i] })),
    );

    // Second (and last) request: both query vectors at once.
    [qCoffee, qSecret] = await embed(
      ["ما عادات تقديم القهوة في الضيافة الخليجية؟", "محتوى سري عن استراتيجية التسويق الرقمي"],
      "query",
    );
  }, 120000);

  afterAll(async () => {
    if (!db) return;
    for (const oid of [orgA, orgB].filter(Boolean)) {
      await db.delete(schema.sourceChunks).where(eq(schema.sourceChunks.orgId, oid));
      await db.delete(schema.sources).where(eq(schema.sources.orgId, oid));
      await db.delete(schema.brands).where(eq(schema.brands.orgId, oid));
      await db.delete(schema.memberships).where(eq(schema.memberships.orgId, oid));
      await db.delete(schema.organizations).where(eq(schema.organizations.id, oid));
    }
    await sql!.end({ timeout: 3 });
  });

  it("returns the topically relevant chunk first", async () => {
    const res = await forOrg(db!, orgA).retrieve(brandA, qCoffee, 3);
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].content).toContain("القهوة");
  });

  it("A CANNOT retrieve B's chunks (tenancy)", async () => {
    const res = await forOrg(db!, orgA).retrieve(brandA, qSecret, 5);
    expect(res.every((r) => !r.content.includes("سري"))).toBe(true);
  });

  it("countChunks is org+brand scoped", async () => {
    expect(await forOrg(db!, orgA).countChunks(brandA)).toBeGreaterThan(0);
    expect(await forOrg(db!, orgA).countChunks(brandB)).toBe(0);
  });
});

it.runIf(!canRun)("skipped retrieval: no DATABASE_URL or VOYAGE_API_KEY", () => {
  expect(true).toBe(true);
});
