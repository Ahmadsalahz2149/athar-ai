/**
 * Golden-set quality eval. Runs the REAL DNA + draft prompts against eval/goldenset.ts
 * and scores the output with the deterministic rubric. Exits non-zero if any case
 * fails, so it can gate CI (with an ANTHROPIC_API_KEY secret) or be run locally:
 *
 *   npm run eval
 *
 * Uses the Anthropic SDK directly (not lib/ai/generate.ts, which is server-only).
 * Defaults to cheap models; override with ANTHROPIC_DNA_MODEL / ANTHROPIC_DRAFT_MODEL.
 */
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/models";
import {
  DNA_SYSTEM,
  DNA_SCHEMA,
  buildDnaUserMessage,
  DRAFT_SYSTEM,
  DRAFTS_SCHEMA,
  buildDraftUserMessage,
  DNA_PROMPT_ID,
  DNA_PROMPT_VERSION,
  DRAFT_PROMPT_ID,
  DRAFT_PROMPT_VERSION,
} from "@/lib/ai/prompts";
import { normalizeDna, normalizeDrafts } from "@/lib/ai/normalize";
import { extractJson } from "@/lib/ai/json";
import { scoreDna, scoreDrafts, type Score } from "@/lib/eval/rubric";
import { GOLDEN_SET } from "./goldenset";

// Load .env.local so the key + model overrides are available when run outside Next.
function loadEnvLocal() {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i < 0) continue;
    const k = s.slice(0, i).trim();
    let v = s.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnvLocal();

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  console.error("✗ ANTHROPIC_API_KEY not set (add it to .env.local). Eval needs a key to run.");
  process.exit(2);
}

const client = new Anthropic({ apiKey: KEY });
const DNA_MODEL = process.env.ANTHROPIC_DNA_MODEL || MODELS.HAIKU;
const DRAFT_MODEL = process.env.ANTHROPIC_DRAFT_MODEL || MODELS.HAIKU;

type Block = { type: string; text?: string };

async function gen(system: string, user: string, schema: unknown, maxTokens: number, model: string) {
  const msg = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { format: { type: "json_schema" as const, schema: schema as Record<string, unknown> } },
  });
  const text = (msg.content as Block[])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n");
  return { text, truncated: msg.stop_reason === "max_tokens" };
}

function line(name: string, s: Score) {
  const mark = s.pass ? "✓" : "✗";
  const failed = s.checks.filter((c) => !c.pass).map((c) => (c.critical ? `${c.name}!` : c.name));
  const detail = failed.length ? `  ✗ ${failed.join(", ")}` : "";
  console.log(`   ${mark} ${name}: ${(s.score * 100).toFixed(0)}%${detail}`);
}

async function main() {
  console.log(`\nGolden-set eval — DNA:${DNA_MODEL}  draft:${DRAFT_MODEL}`);
  console.log(`prompts: ${DNA_PROMPT_ID}@${DNA_PROMPT_VERSION}, ${DRAFT_PROMPT_ID}@${DRAFT_PROMPT_VERSION}\n`);

  let failures = 0;
  for (const c of GOLDEN_SET) {
    console.log(`● ${c.label} (${c.id})`);
    try {
      const dnaRes = await gen(DNA_SYSTEM, buildDnaUserMessage(c.samples), DNA_SCHEMA, 4096, DNA_MODEL);
      const dna = normalizeDna(extractJson<unknown>(dnaRes.text));
      const dnaScore = scoreDna(dna, c.dna);
      line("DNA", dnaScore);

      const draftRes = await gen(
        DRAFT_SYSTEM,
        buildDraftUserMessage({ dna, topic: c.draft.topic, platform: c.draft.platform, count: c.draft.count }),
        DRAFTS_SCHEMA,
        8192,
        DRAFT_MODEL,
      );
      const drafts = normalizeDrafts(extractJson<unknown>(draftRes.text));
      const draftScore = scoreDrafts(drafts, c.draft);
      line("drafts", draftScore);

      if (!dnaScore.pass || !draftScore.pass) failures++;
    } catch (e) {
      console.log(`   ✗ ERROR: ${e instanceof Error ? e.message : String(e)}`);
      failures++;
    }
    console.log("");
  }

  const total = GOLDEN_SET.length;
  const passed = total - failures;
  console.log(`━━ ${passed}/${total} cases passed ━━`);
  if (failures > 0) {
    console.error("✗ Eval FAILED — output quality below the gate.");
    process.exit(1);
  }
  console.log("✓ Eval passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
