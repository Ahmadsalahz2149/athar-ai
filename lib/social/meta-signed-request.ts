import crypto from "node:crypto";

/**
 * Meta's `signed_request` (Phase 6 — App Review prerequisites).
 *
 * Meta posts this to the data-deletion and deauthorize callbacks to say "this
 * user wants their data gone" or "this user removed your app". It is the only
 * thing identifying the person, and it arrives on a PUBLIC endpoint — so the
 * signature is not a formality. Without verification, anyone who can POST to
 * the URL can delete any account's social connections by guessing a user id.
 *
 * Pure and dependency-free so every rule about what is accepted can be tested
 * against a crafted payload, including the ones that matter most: a tampered
 * body, a wrong secret, and an unexpected algorithm.
 *
 * Format: `<base64url signature>.<base64url json payload>`, where the signature
 * is HMAC-SHA256 of the *encoded payload string* — not of the decoded JSON.
 */

export type SignedRequestPayload = {
  /** The Meta user id. This is the key the deletion is about. */
  user_id?: string;
  algorithm?: string;
  issued_at?: number;
  [k: string]: unknown;
};

export type ParseResult =
  | { ok: true; payload: SignedRequestPayload; userId: string }
  | { ok: false; reason: "malformed" | "bad_algorithm" | "bad_signature" | "no_user" | "no_secret" };

function b64urlToBuffer(s: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  try {
    return Buffer.from(s, "base64url");
  } catch {
    return null;
  }
}

/**
 * Verify and decode. Returns a reason rather than throwing, because the caller
 * is an HTTP route that has to answer differently for "not for us" and "this is
 * forged".
 */
export function parseSignedRequest(signed: string, appSecret: string): ParseResult {
  if (!appSecret) return { ok: false, reason: "no_secret" };
  if (typeof signed !== "string") return { ok: false, reason: "malformed" };

  const dot = signed.indexOf(".");
  if (dot <= 0 || dot === signed.length - 1) return { ok: false, reason: "malformed" };

  const encodedSig = signed.slice(0, dot);
  const encodedPayload = signed.slice(dot + 1);

  const sig = b64urlToBuffer(encodedSig);
  const payloadBuf = b64urlToBuffer(encodedPayload);
  if (!sig || !payloadBuf) return { ok: false, reason: "malformed" };

  let payload: SignedRequestPayload;
  try {
    payload = JSON.parse(payloadBuf.toString("utf8")) as SignedRequestPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!payload || typeof payload !== "object") return { ok: false, reason: "malformed" };

  // Checked BEFORE the signature is compared. A payload that names a different
  // algorithm is not something to verify with ours and accept anyway — that is
  // how algorithm-confusion bugs happen.
  if (payload.algorithm !== "HMAC-SHA256") return { ok: false, reason: "bad_algorithm" };

  // Signed over the ENCODED payload, exactly as received.
  const expected = crypto.createHmac("sha256", appSecret).update(encodedPayload).digest();

  // Length must match before timingSafeEqual, which throws on a mismatch — and
  // a thrown error here would be a 500 on a forged request instead of a clean
  // refusal.
  if (sig.length !== expected.length) return { ok: false, reason: "bad_signature" };
  if (!crypto.timingSafeEqual(sig, expected)) return { ok: false, reason: "bad_signature" };

  const userId = typeof payload.user_id === "string" ? payload.user_id.trim() : "";
  if (!userId) return { ok: false, reason: "no_user" };

  return { ok: true, payload, userId };
}

/** Build one — used by the tests, and by anyone reproducing a callback locally. */
export function signRequest(payload: SignedRequestPayload, appSecret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", appSecret).update(encoded).digest("base64url");
  return `${sig}.${encoded}`;
}

/**
 * A short, unambiguous code the person can quote back.
 *
 * Meta shows it to the user and expects our status page to accept it, so it is
 * read aloud and typed by hand: no vowels (nothing spells a word by accident),
 * no 0/O or 1/I/L (the pairs people transcribe wrongly).
 */
const CODE_ALPHABET = "23456789BCDFGHJKMNPQRSTVWXYZ";

export function newConfirmationCode(length = 12): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}
