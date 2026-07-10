import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Pin the workspace root (a stray lockfile in $HOME was being inferred).
  turbopack: { root: import.meta.dirname },
};

export default withNextIntl(nextConfig);
