import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-only Anthropic client. The API key never reaches the browser bundle
 * (enforced by `server-only`). Set ANTHROPIC_API_KEY in .env.local / Vercel env.
 */
let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  // Bound each attempt: the SDK default is 10 minutes (scaling higher for large
  // max_tokens on non-streaming calls), far past the routes' own limits — a
  // stalled provider would hold the request open well beyond them. Units are
  // milliseconds in the TypeScript SDK. maxRetries is left at the SDK default.
  client ??= new Anthropic({ apiKey, timeout: 180_000 });
  return client;
}

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
