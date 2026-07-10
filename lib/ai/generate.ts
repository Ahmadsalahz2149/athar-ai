import "server-only";
import { getAnthropic, hasAnthropicKey } from "./anthropic";

/**
 * Provider abstraction. Default = Anthropic (Claude). Set AI_PROVIDER=minimax to
 * route generation to MiniMax's OpenAI-compatible endpoint (to conserve Claude
 * credits). The rest of the app is provider-agnostic — it only calls generateText().
 */
export type Provider = "anthropic" | "minimax";

export function currentProvider(): Provider {
  return process.env.AI_PROVIDER === "minimax" ? "minimax" : "anthropic";
}

export function hasProviderKey(): boolean {
  return currentProvider() === "minimax"
    ? Boolean(process.env.MINIMAX_API_KEY)
    : hasAnthropicKey();
}

export type GenArgs = {
  system: string;
  user: string;
  maxTokens: number;
  /** Anthropic model to use when provider = anthropic. */
  anthropicModel: string;
  /** Optional JSON schema for Anthropic structured output (ignored by MiniMax). */
  schema?: unknown;
};

export type GenResult = {
  text: string;
  truncated: boolean;
  provider: Provider;
  model: string;
};

export async function generateText(args: GenArgs): Promise<GenResult> {
  return currentProvider() === "minimax" ? minimaxGenerate(args) : anthropicGenerate(args);
}

type TextyBlock = { type: string; text?: string };

async function anthropicGenerate(args: GenArgs): Promise<GenResult> {
  const client = getAnthropic();
  const msg = await client.messages.create({
    model: args.anthropicModel,
    max_tokens: args.maxTokens,
    system: args.system,
    messages: [{ role: "user", content: args.user }],
    ...(args.schema
      ? { output_config: { format: { type: "json_schema" as const, schema: args.schema as Record<string, unknown> } } }
      : {}),
  });
  const text = (msg.content as TextyBlock[])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n");
  return {
    text,
    truncated: msg.stop_reason === "max_tokens",
    provider: "anthropic",
    model: args.anthropicModel,
  };
}

async function minimaxGenerate(args: GenArgs): Promise<GenResult> {
  const base = (process.env.MINIMAX_BASE_URL || "https://api.minimax.io/v1").replace(/\/$/, "");
  const key = process.env.MINIMAX_API_KEY;
  const model = process.env.MINIMAX_MODEL || "MiniMax-M2";
  if (!key) throw new Error("MINIMAX_API_KEY is not set.");

  // MiniMax is a reasoning model and a Chinese model — force JSON-only, Arabic-only.
  const guard =
    "\n\nCRITICAL: Respond with ONE valid JSON object ONLY, written in Arabic. " +
    "Do NOT output any Chinese characters. No reasoning, no <think> tags, no markdown fences, " +
    "and no text before or after the JSON.";

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: args.maxTokens,
      messages: [
        { role: "system", content: args.system + guard },
        { role: "user", content: args.user },
      ],
    }),
  });

  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`MiniMax ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }
  const choice = (data as { choices?: Array<{ message?: { content?: string }; finish_reason?: string }> }).choices?.[0];
  const raw = choice?.message?.content ?? "";
  const text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  return {
    text,
    truncated: choice?.finish_reason === "length",
    provider: "minimax",
    model,
  };
}
