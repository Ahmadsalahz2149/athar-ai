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
  client ??= new Anthropic({ apiKey });
  return client;
}

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
