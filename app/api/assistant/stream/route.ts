import { db } from "@/lib/db";
import { forOrg } from "@/lib/db/forOrg";
import { currentContext } from "@/lib/auth/current";
import { hasKeyFor, streamAnthropicText } from "@/lib/ai/generate";
import { MODELS } from "@/lib/ai/models";
import { estimateRewrite } from "@/lib/credits/costs";
import { ASSISTANT_SYSTEM, buildAssistantContext, buildBrandContext } from "@/lib/ai/prompts";

/**
 * Live token streaming for the floating brand assistant (Phase 3 #20). Streams
 * the reply so it types out word-by-word. Folds in the brand's DNA + profile +
 * products, keeps the recent transcript, and persists both turns + debits once
 * the stream completes.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  if (!db) return new Response("no_db", { status: 503 });
  if (!hasKeyFor("anthropic")) return new Response("no_key", { status: 400 });
  const ctx = await currentContext();
  if (!ctx) return new Response("no_session", { status: 401 });

  const { message, history } = (await req.json().catch(() => ({}))) as { message?: string; history?: Msg[] };
  if (typeof message !== "string" || !message.trim()) return new Response("empty", { status: 400 });

  const t = forOrg(db, ctx.orgId);
  const estimate = estimateRewrite();
  if ((await t.balance()) < estimate) return new Response("insufficient_credits", { status: 402 });

  let brandBlock = "";
  try {
    const [dna, profile, products] = await Promise.all([t.currentDna(ctx.brandId), t.getBrandProfile(ctx.brandId), t.listProducts(ctx.brandId)]);
    brandBlock = buildAssistantContext({ dna, brand: buildBrandContext({ profile, products }) });
  } catch {
    /* best-effort */
  }
  const recent = (history ?? []).slice(-8).map((m) => `${m.role === "assistant" ? "المساعد" : "المستخدم"}: ${m.content}`).join("\n");
  const user = [brandBlock, recent ? `المحادثة السابقة:\n${recent}` : "", `المستخدم: ${message.trim()}`, `المساعد:`].filter(Boolean).join("\n\n");
  const model = process.env.ANTHROPIC_DRAFT_MODEL || MODELS.SONNET;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        for await (const delta of streamAnthropicText({ system: ASSISTANT_SYSTEM, user, maxTokens: 1024, model })) {
          if (delta) { full += delta; controller.enqueue(encoder.encode(delta)); }
        }
        if (full.trim()) {
          await t.saveAssistantMessages(ctx.brandId, [{ role: "user", content: message.trim() }, { role: "assistant", content: full.trim() }]);
          await t.debit(estimate, "assistant_chat", "brand", ctx.brandId);
        }
      } catch {
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
