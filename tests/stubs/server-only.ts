/**
 * `server-only` is a build-time guard: importing it from a Client Component is
 * meant to fail the bundle. It has no runtime behaviour, and Vitest cannot
 * resolve its Next-specific export map, so tests alias it to this empty module.
 * The real guard still applies to the application build.
 */
export {};
