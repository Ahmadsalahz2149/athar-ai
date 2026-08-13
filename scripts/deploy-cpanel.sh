#!/bin/sh
set -eu

APP_ROOT=/home/athar/apps/athar-ai
RELEASES_ROOT="$APP_ROOT/.releases"
PUBLIC_ROOT=/home/athar/public_html
HTACCESS="$PUBLIC_ROOT/.htaccess"
NODE=/opt/cpanel/ea-nodejs22/bin/node
NPM=/opt/cpanel/ea-nodejs22/bin/npm
APP_PORT=${ATHAR_APP_PORT:-3101}

# cPanel accounts often default to an older system Node. npm's launcher uses
# `/usr/bin/env node`, so put the selected EA runtime first for every child
# process, including the `next` binary invoked by npm scripts.
PATH=/opt/cpanel/ea-nodejs22/bin:$PATH
export PATH

cd "$APP_ROOT"

# Refuse to build without the server-only production configuration. Next.js
# also needs the NEXT_PUBLIC_* values while compiling browser bundles.
test -s .env.production

# A clean build is essential: merging two Turbopack outputs can leave HTML and
# the server runtime pointing at chunks that no longer exist.
rm -rf .next
"$NPM" ci
"$NPM" run build

# Standalone does not copy these directories automatically. Assemble an
# immutable release outside .next, then switch the `current` symlink only when
# the release is complete. A failed future build cannot damage the live app.
build_id=$(cat "$APP_ROOT/.next/standalone/.next/BUILD_ID")
release="$RELEASES_ROOT/$build_id"
stage="$RELEASES_ROOT/.${build_id}.tmp.$$"
mkdir -p "$RELEASES_ROOT"
rm -rf "$stage"
mkdir -p "$stage"
cp -R "$APP_ROOT/.next/standalone/." "$stage/"
rm -rf "$stage/.next/static" "$stage/public"
cp -R "$APP_ROOT/.next/static" "$stage/.next/static"
cp -R "$APP_ROOT/public" "$stage/public"
cp "$APP_ROOT/.env.production" "$stage/.env.production"
rm -rf "$release"
mv "$stage" "$release"
ln -sfn "$release" "$APP_ROOT/current"

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
  "$APP_PORT" "$build_id"
