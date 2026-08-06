import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Private object storage for raw uploads (INFRA phase 2). Files are stashed here
 * by the ingest server action, then the background job downloads + processes them
 * so long transcriptions/extractions never run inside the request. Service-role
 * client (bypasses RLS); the bucket is private and never exposed to the browser.
 */
const BUCKET = "uploads";

let cached: SupabaseClient | null | undefined;
function service(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return cached;
}

export function hasStorage(): boolean {
  return !!service();
}

let bucketReady = false;
/** Create the private uploads bucket if it doesn't exist yet (idempotent). */
async function ensureBucket(client: SupabaseClient): Promise<void> {
  if (bucketReady) return;
  const { data } = await client.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await client.storage.createBucket(BUCKET, { public: false });
    // Ignore "already exists" races between concurrent workers.
    if (error && !/exist/i.test(error.message)) throw new Error(`createBucket: ${error.message}`);
  }
  bucketReady = true;
}

/** Upload raw bytes; returns the storage path to persist on the job payload. */
export async function uploadBytes(path: string, bytes: Uint8Array | ArrayBuffer, contentType?: string): Promise<string> {
  const client = service();
  if (!client) throw new Error("storage not configured");
  await ensureBucket(client);
  const body = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  const { error } = await client.storage.from(BUCKET).upload(path, body, { contentType: contentType || "application/octet-stream", upsert: true });
  if (error) throw new Error(`upload: ${error.message}`);
  return path;
}

/** Download bytes for processing inside a job. */
export async function downloadBytes(path: string): Promise<Uint8Array> {
  const client = service();
  if (!client) throw new Error("storage not configured");
  const { data, error } = await client.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`download: ${error?.message ?? "no data"}`);
  return new Uint8Array(await data.arrayBuffer());
}

/** Best-effort cleanup after successful processing. */
export async function removeObject(path: string): Promise<void> {
  const client = service();
  if (!client) return;
  await client.storage.from(BUCKET).remove([path]);
}

// Public bucket for brand assets (logos) — served by a stable public URL so the
// image never bloats a DB row as a data URI (Phase 3 perf).
const PUBLIC_BUCKET = "public-assets";
let publicBucketReady = false;
async function ensurePublicBucket(client: SupabaseClient): Promise<void> {
  if (publicBucketReady) return;
  const { data } = await client.storage.getBucket(PUBLIC_BUCKET);
  if (!data) {
    const { error } = await client.storage.createBucket(PUBLIC_BUCKET, { public: true });
    if (error && !/exist/i.test(error.message)) throw new Error(`createBucket: ${error.message}`);
  }
  publicBucketReady = true;
}

/** Upload public bytes and return a stable public URL (throws if storage/bucket
 * unavailable so callers can fall back). */
export async function uploadPublic(path: string, bytes: Uint8Array, contentType: string): Promise<string> {
  const client = service();
  if (!client) throw new Error("storage not configured");
  await ensurePublicBucket(client);
  const { error } = await client.storage.from(PUBLIC_BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`upload: ${error.message}`);
  return client.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl;
}
