/**
 * Central registration point for job handlers. Importing this module registers
 * every handler as a side effect, so the worker route only needs one import.
 *
 * Phase 1 ships the registry empty; phase 2 registers ingest_source and
 * analyze_source here. Keeping registration in one module avoids scattering
 * import-for-side-effect calls across the codebase.
 */

// Phase 2 will add, e.g.:
// import { registerHandler } from "./runner";
// registerHandler("ingest_source", ingestSourceHandler);
// registerHandler("analyze_source", analyzeSourceHandler);

export {};
