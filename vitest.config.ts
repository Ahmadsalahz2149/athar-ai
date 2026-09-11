import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      // See tests/stubs/server-only.ts — build-time guard, no runtime behaviour.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // One database, several suites. The job queue is cross-org by design —
    // claimNext() takes the oldest runnable job in the WHOLE table — so a suite
    // that enqueues jobs will steal another suite's job if they run at the same
    // time. That is a test-harness race, not a product bug, and serialising the
    // files removes the whole class of it for ~1s of wall clock.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
