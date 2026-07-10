import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

/** Extract plain text from a PDF (server-only; used for uploads and URL fetches). */
export async function extractPdfText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : text).trim();
}
