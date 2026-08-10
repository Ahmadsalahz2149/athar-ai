# syntax=docker/dockerfile:1
# Production image for Athar (Next.js 16, standalone output). Built by Coolify
# from this Dockerfile. Multi-stage so the runtime image carries only the
# compiled server + static assets — no dev deps, no source.

FROM node:22-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1

# --- dependencies (cached unless the lockfile changes) ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so they
# must be present here. In Coolify, mark these two as "Build Variable".
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm run build

# --- runtime ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Bind all interfaces so the container is reachable from the reverse proxy.
ENV HOSTNAME=0.0.0.0
RUN groupadd -r nodejs && useradd -r -g nodejs nextjs
# Standalone server + the static/public assets it does not bundle.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
