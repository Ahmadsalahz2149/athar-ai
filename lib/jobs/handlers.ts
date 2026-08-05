/**
 * Central registration point for job handlers. Importing this module registers
 * every handler as a side effect, so the worker route + kicker only need one
 * import.
 */
import { registerHandler } from "./runner";
import { ingestSourceHandler } from "./handlers/ingestSource";
import { analyzeSourceHandler } from "./handlers/analyzeSource";
import { synthesizeDnaHandler } from "./handlers/synthesizeDna";

registerHandler("ingest_source", ingestSourceHandler);
registerHandler("analyze_source", analyzeSourceHandler);
registerHandler("synthesize_dna", synthesizeDnaHandler);

export {};
