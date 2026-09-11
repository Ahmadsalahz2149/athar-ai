import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { hasKeyFor } from "@/lib/ai/generate";
import { streamAnthropicText } from "@/lib/ai/generate";
import { MODELS } from "@/lib/ai/models";
import { estimateRewrite } from "@/lib/credits/costs";
import { REWRITE_SYSTEM_PLAIN, buildRewriteMessage } from "@/lib/ai/prompts";
import { log } from "@/lib/log";
import { consume, LIMITS } from "@/lib/rate-limit";

/**
 * Live token streaming for Studio rewrites (INFRA phase 4). Streams the rewritten
 * post body as plain text so the editor fills in real time. Anthropic only — the
 * client falls back to the non-streaming studioRewrite action for other providers.
 * Credits are debited once the stream completes successfully.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!db) return new Response("no_db", { status: 503 });
  if (!hasKeyFor("anthropic")) return new Response("no_key", { status: 400 });

  const ctx = await currentContext();
  if (!ctx) return new Response("no_session", { status: 401 });

  // Burst guard in front of the provider. Credits are the real cost control,
  // but they don't stop a tight loop from hammering Anthropic first.
  const rl = consume(`ai:${ctx.orgId}`, LIMITS.aiStream.limit, LIMITS.aiStream.windowMs);
  if (!rl.ok) {
    return new Response("rate_limited", {
      status: 429,
      headers: { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) },
    });
  }

  const { body, tool, model } = (await req.json().catch(() => ({}))) as { body?: string; tool?: string; model?: string };
  if (typeof body !== "string" || !body.trim()) return new Response("no_body", { status: 400 });

  const t = forOrg(db, ctx.orgId);
  const dna = await t.currentDna(ctx.brandId);
  if (!dna) return new Response("no_dna", { status: 400 });

  const estimate = estimateRewrite();
  if ((await t.balance()) < estimate) return new Response("insufficient_credits", { status: 402 });

  const user = buildRewriteMessage({ body, tool: tool || "regenerate", dna });
  const modelId = model && /claude/i.test(model) ? model : process.env.ANTHROPIC_DRAFT_MODEL || MODELS.HAIKU;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let produced = false;
      try {
        for await (const delta of streamAnthropicText({ system: REWRITE_SYSTEM_PLAIN, user, maxTokens: 3072, model: modelId })) {
          if (delta) { produced = true; controller.enqueue(encoder.encode(delta)); }
        }
        if (produced) await t.debit(estimate, "studio_rewrite", "brand", ctx.brandId);
      } catch (e) {
        // Surface a terminal marker the client can detect; partial text stays usable.
        // Also record it — previously the failure left no trace server-side.
        log.error("studio.rewrite_stream_failed", { orgId: ctx.orgId }, e);
        controller.enqueue(encoder.encode("\n ERROR"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
