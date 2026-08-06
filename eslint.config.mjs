import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Ban raw db.<query>() on tenant tables — everything must go through the
// forOrg(db, orgId) façade so queries are org-scoped (ADR-005). The CI tenancy
// test proves isolation; this rule stops a new call site from bypassing it.
const FACADE_MSG =
  "Direct db query is forbidden outside the tenancy façade. Use forOrg(db, orgId) so every query is org-scoped (ADR-005). See lib/db/forOrg.ts.";
const restrictFacade = {
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector:
          "CallExpression[callee.property.name=/^(select|insert|update|delete)$/][callee.object.name='db']",
        message: FACADE_MSG,
      },
      {
        // Same, but for `db!.select(...)` (non-null assertion, common in tests).
        selector:
          "CallExpression[callee.property.name=/^(select|insert|update|delete)$/][callee.object.expression.name='db']",
        message: FACADE_MSG,
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Apply the façade rule across app + shared code.
  {
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ...restrictFacade,
  },
  // Legitimate exceptions: the façade itself, the db client, org/brand bootstrap
  // (creates the org before any façade exists), and test/eval setup + teardown.
  {
    files: [
      "lib/db/forOrg.ts",
      "lib/db/index.ts",
      "lib/auth/bootstrap.ts",
      // Public link page (#17) — no org context; the handle is the lookup key,
      // and it only touches public link-page data. See lib/link/publicLookup.ts.
      "lib/link/publicLookup.ts",
      "tests/**/*.{ts,tsx}",
      "eval/**/*.{ts,tsx}",
    ],
    rules: { "no-restricted-syntax": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored design prototype — reference only, not app code.
    "design-reference/**",
  ]),
]);

export default eslintConfig;
