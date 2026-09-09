import { execSync } from "node:child_process";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/**
 * The commit this build was produced from, resolved at build time and exposed
 * to the app via `env` below so `/api/health` can report exactly which revision
 * is live — a deploy is then verifiable with one curl instead of an SSH session.
 *
 * Resolved here rather than through `generateBuildId` on purpose: that would
 * name the release directory after the commit, and deploy-cpanel.sh does
 * `rm -rf "$release"` before installing, so re-deploying the SAME commit would
 * briefly delete the files of the running release. The random build id keeps
 * that collision impossible.
 */
function buildCommit(): string {
  const fromEnv = process.env.ATHAR_COMMIT ?? process.env.GIT_COMMIT;
  if (fromEnv) return fromEnv.trim().slice(0, 12);
  try {
    // The production build runs inside the git checkout, so this resolves there
    // too; the assembled standalone release carries the value already inlined.
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "unknown"; // building from a tarball / no git — never fail the build
  }
}

const nextConfig: NextConfig = {
  // Inlined at build time (see buildCommit). Only the short commit hash, which
  // is not sensitive; `env` values are always included in the JS bundle.
  env: { ATHAR_COMMIT: buildCommit() },

  // Self-hosted (Coolify/Docker) production build: emit a minimal standalone
  // server (.next/standalone/server.js) so the runtime image stays small and
  // has no dev dependencies. Ignored by Vercel, which uses its own adapter.
  output: "standalone",

  // Pin the workspace root (a stray lockfile in $HOME was being inferred).
  turbopack: { root: import.meta.dirname },

  // Allow the dev server's assets/HMR to be requested cross-origin from a phone
  // on the LAN (Next 16 blocks this by default and prints a warning otherwise).
  allowedDevOrigins: ["10.207.10.120", "*.trycloudflare.com"],

  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    }];
  },

  // Server Actions (login/signup, generation) are CSRF-protected by comparing
  // Origin vs Host. When you open the dev server from a phone via the machine's
  // LAN IP instead of localhost, that check rejects the action and login fails.
  // Allow the LAN origins used for on-device testing. If your machine's IP
  // changes, add it here (find it with `ipconfig getifaddr en0`).
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "127.0.0.1:3000",
        "10.207.10.120:3000",
        "*.trycloudflare.com",
      ],
      // Audio/video uploads for transcription go through a Server Action.
      bodySizeLimit: "30mb",
    },
  },
};

export default withNextIntl(nextConfig);
