#!/bin/sh
set -eu

APP_ROOT=/home/athar/apps/athar-ai
RUNTIME_ROOT="$APP_ROOT/.next/standalone"
RUNTIME_NEXT="$RUNTIME_ROOT/.next"
PUBLIC_ROOT=/home/athar/public_html
HTACCESS="$PUBLIC_ROOT/.htaccess"
NODE=/opt/cpanel/ea-nodejs22/bin/node
NPM=/opt/cpanel/ea-nodejs22/bin/npm
APP_PORT=${ATHAR_APP_PORT:-3101}

cd "$APP_ROOT"

# Refuse to build without the server-only production configuration. Next.js
# also needs the NEXT_PUBLIC_* values while compiling browser bundles.
test -s .env.production

# A clean build is essential: merging two Turbopack outputs can leave HTML and
# the server runtime pointing at chunks that no longer exist.
rm -rf .next
"$NPM" ci
"$NPM" run build

# Standalone does not copy these directories automatically. Replace them as
# complete trees instead of overlaying them so stale chunks cannot survive.
rm -rf "$RUNTIME_NEXT/static" "$RUNTIME_ROOT/public"
cp -R "$APP_ROOT/.next/static" "$RUNTIME_NEXT/static"
cp -R "$APP_ROOT/public" "$RUNTIME_ROOT/public"
cp "$APP_ROOT/.env.production" "$RUNTIME_ROOT/.env.production"

chmod 755 "$APP_ROOT/scripts/ensure-production-server.sh"
ATHAR_APP_PORT="$APP_PORT" "$APP_ROOT/scripts/ensure-production-server.sh"

# Switch Apache only after the new runtime answers its health check. The
# previous port therefore remains available if build/start fails.
tmp="$HTACCESS.tmp.$$"
sed "s#127\\.0\\.0\\.1:[0-9][0-9]*#127.0.0.1:${APP_PORT}#g" "$HTACCESS" >"$tmp"
mv "$tmp" "$HTACCESS"

curl --fail --silent --show-error --max-time 10 \
  "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null

printf 'Athar deployed successfully on port %s (build %s).\n' \
  "$APP_PORT" "$(cat "$RUNTIME_NEXT/BUILD_ID")"
