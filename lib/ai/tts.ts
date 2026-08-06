/** MiniMax text-to-audio (Phase 3 #2). ElevenLabs' free tier blocks TTS via the
 * API ("paid_plan_required"), so voice-over uses MiniMax (same key as image
 * generation), which synthesizes Arabic. Returns MP3 bytes decoded from the
 * hex payload MiniMax sends back. */

export function hasTtsKey(): boolean {
  return !!process.env.MINIMAX_API_KEY;
}

export const VOICES = [
  { id: "male-qn-qingse", ar: "شاب" },
  { id: "male-qn-jingying", ar: "رجل واثق" },
  { id: "female-shaonv", ar: "شابة" },
  { id: "female-yujie", ar: "امرأة راقية" },
  { id: "presenter_male", ar: "مذيع" },
  { id: "audiobook_male_1", ar: "راوٍ" },
] as const;
export type VoiceId = (typeof VOICES)[number]["id"];

const MODEL = process.env.MINIMAX_TTS_MODEL || "speech-02-turbo";

/** Synthesize speech; returns MP3 bytes. Text is capped to keep clips small. */
export async function textToSpeech(text: string, opts?: { voiceId?: string; speed?: number }): Promise<Uint8Array> {
  const base = (process.env.MINIMAX_BASE_URL || "https://api.minimax.io/v1").replace(/\/$/, "");
  const key = process.env.MINIMAX_API_KEY;
  if (!key) throw new Error("MINIMAX_API_KEY is not set");
  const voiceId = opts?.voiceId && VOICES.some((v) => v.id === opts.voiceId) ? opts.voiceId : "male-qn-jingying";
  const res = await fetch(`${base}/t2a_v2`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      text: text.slice(0, 2000),
      stream: false,
      voice_setting: { voice_id: voiceId, speed: opts?.speed ?? 1, vol: 1, pitch: 0 },
      audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: { audio?: string }; base_resp?: { status_code?: number; status_msg?: string } };
  const code = json?.base_resp?.status_code;
  if (!res.ok || (typeof code === "number" && code !== 0)) {
    throw new Error(`MiniMax tts ${res.status}/${code}: ${json?.base_resp?.status_msg ?? "failed"}`);
  }
  const hex = json?.data?.audio;
  if (!hex) throw new Error("MiniMax tts: no audio returned");
  return Uint8Array.from(Buffer.from(hex, "hex"));
}
