/**
 * Provider HTTP with a hard timeout. Deliberately free of `server-only` (like
 * ssrf.ts) so the modules that use it stay unit-testable; it holds no secrets.
 *
 * None of the provider calls (MiniMax, Voyage, ElevenLabs) set an AbortSignal,
 * so a provider that accepted the connection and then stopped responding held
 * the server action or job open until the platform killed it — burning the
 * whole function budget and, in a job, the attempt with it. Every provider call
 * now fails fast with a clear message instead.
 */
export const PROVIDER_TIMEOUT_MS = 60_000;

export async function providerFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = PROVIDER_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") {
      throw new Error(`provider request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
