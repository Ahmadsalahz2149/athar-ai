# Dependency advisories

`npm audit` runs on every deploy, so its output has to mean something. A
standing wall of warnings trains everyone to ignore the one that matters.

## Current state

| Scope | Critical | High | Moderate |
|---|---|---|---|
| **Production** (`npm audit --omit=dev`) | 0 | 0 | 0 |
| All, including build/test tooling | 0 | 0 | 6 |

Anything reachable from a running server is clean. The six that remain are
tooling that never ships.

## What was fixed, and how

Four advisories were transitive — nothing we depend on directly — so they are
pinned with `overrides` rather than by bumping a parent and changing a major
version underneath us:

| Package | Reached via | Pinned |
|---|---|---|
| `browserslist` (high) | `@sentry/nextjs` → webpack | `^4.28.9` |
| `baseline-browser-mapping` | same | `^2.11.22` |
| `js-yaml` (high) | eslint tooling | `^4.3.2` |
| `brace-expansion` (high) | minimatch | per line, below |

`brace-expansion` needed care. It ships two incompatible lines: ESLint's
`minimatch@3` wants the v1 CommonJS shape, `minimatch@10` wants v5. A single
blanket override forced v5 on both and broke `npm run lint` outright with
`TypeError: expand is not a function` — a fix that silently disables the linter
is worse than the advisory. Each line is therefore patched to its own fixed
release:

```json
"minimatch@3":  { "brace-expansion": "^1.1.18" },
"minimatch@10": { "brace-expansion": "^5.0.9" }
```

## What is accepted, and why

Six moderate advisories remain, all dev-only, in two chains:

- **`drizzle-kit` → `@esbuild-kit/*` → `esbuild`.** The only offered fix is
  `drizzle-kit@0.18.1` — a downgrade of several major versions that would break
  every migration in `drizzle/`. The tool runs by hand, on the operator's own
  machine, against files from this repository; it is not exposed to untrusted
  input. Not worth breaking migrations for.
- **`vitest` / `@vitest/mocker`.** Fixed in `4.1.11`, but installing it crashes
  npm 10.9.7's own dependency resolver (`Cannot read properties of null
  (reading 'edgesOut')`) while walking vitest's peer graph. That is an npm bug,
  not something to force past. Revisit when npm or vitest moves.

Both are test/build-time only and appear in `npm audit`, never in `--omit=dev`.

## Re-checking

```bash
npm audit --omit=dev   # must stay at zero — this is the one that matters
npm audit              # the full picture, including tooling
```

If `--omit=dev` is ever non-zero, that is a real finding: fix it or write down
here why it cannot be fixed.
