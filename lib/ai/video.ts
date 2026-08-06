/** MiniMax video generation (Phase 3 #3). Async: submit a task → poll status →
 * retrieve the file URL. The current MiniMax plan is out of video credits
 * (status_code 2056), so callers surface a clear "needs credits" state; the flow
 * is complete and works the moment the plan has credits. */

export function hasVideoKey(): boolean {
  return !!process.env.MINIMAX_API_KEY;
}

const MODEL = process.env.MINIMAX_VIDEO_MODEL || "T2V-01";

function conf() {
  const base = (process.env.MINIMAX_BASE_URL || "https://api.minimax.io/v1").replace(/\/$/, "");
  const key = process.env.MINIMAX_API_KEY;
  if (!key) throw new Error("MINIMAX_API_KEY is not set");
  return { base, key };
}

export class VideoCreditsError extends Error {
  constructor() {
    super("needs_credits");
    this.name = "VideoCreditsError";
  }
}

/** Submit a text-to-video task; returns its task id. Throws VideoCreditsError
 * when the plan is out of video credits (2056). */
export async function submitVideo(prompt: string): Promise<string> {
  const { base, key } = conf();
  const res = await fetch(`${base}/video_generation`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt: prompt.slice(0, 1500) }),
  });
  const json = (await res.json().catch(() => ({}))) as { task_id?: string; base_resp?: { status_code?: number; status_msg?: string } };
  const code = json?.base_resp?.status_code;
  if (code === 2056) throw new VideoCreditsError();
  if (!res.ok || (typeof code === "number" && code !== 0) || !json.task_id) {
    throw new Error(`MiniMax video ${res.status}/${code}: ${json?.base_resp?.status_msg ?? "failed"}`);
  }
  return json.task_id;
}

export type VideoStatus = { status: "queueing" | "processing" | "success" | "fail"; fileId?: string };

/** Poll a video task's status. */
export async function queryVideo(taskId: string): Promise<VideoStatus> {
  const { base, key } = conf();
  const res = await fetch(`${base}/query/video_generation?task_id=${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const json = (await res.json().catch(() => ({}))) as { status?: string; file_id?: string };
  const s = (json.status ?? "").toLowerCase();
  const status = s === "success" ? "success" : s === "fail" ? "fail" : s === "processing" ? "processing" : "queueing";
  return { status, fileId: json.file_id };
}

/** Resolve a finished task's file id to a downloadable URL. */
export async function retrieveVideoUrl(fileId: string): Promise<string | null> {
  const { base, key } = conf();
  const res = await fetch(`${base}/files/retrieve?file_id=${encodeURIComponent(fileId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const json = (await res.json().catch(() => ({}))) as { file?: { download_url?: string } };
  return json?.file?.download_url ?? null;
}
