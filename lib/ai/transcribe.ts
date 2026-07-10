/** ElevenLabs Scribe speech-to-text (ADR-002). Accepts audio and video files
 * (Scribe extracts the audio track). Synchronous for now; long files move to a
 * background job in a later pass. */

export const TRANSCRIBE_MODEL = process.env.ELEVENLABS_STT_MODEL || "scribe_v1";
const ENDPOINT = "https://api.elevenlabs.io/v1/speech-to-text";

export function hasTranscribeKey(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

export async function transcribeAudio(file: Blob, filename = "audio"): Promise<string> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
  const form = new FormData();
  form.append("model_id", TRANSCRIBE_MODEL);
  form.append("file", file, filename);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "xi-api-key": key },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}
