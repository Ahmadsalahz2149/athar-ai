import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Pin the workspace root (a stray lockfile in $HOME was being inferred).
  turbopack: { root: import.meta.dirname },

  // Allow the dev server's assets/HMR to be requested cross-origin from a phone
  // on the LAN (Next 16 blocks this by default and prints a warning otherwise).
  allowedDevOrigins: ["10.207.10.120", "*.trycloudflare.com"],

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
