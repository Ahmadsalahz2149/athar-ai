#!/bin/sh
set -eu

APP_ROOT=/home/athar/apps/athar-ai
RELEASES_ROOT="$APP_ROOT/.releases"
NPM=/opt/cpanel/ea-nodejs22/bin/npm

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
cp "$APP_ROOT/deploy/passenger-app.js" "$stage/app.js"
mkdir -p "$stage/tmp"
rm -rf "$release"
mv "$stage" "$release"
ln -sfn "$release" "$APP_ROOT/current"

# Passenger is the only production process manager. It detects app.js and
# restarts the application after this timestamp changes.
touch "$APP_ROOT/current/tmp/restart.txt"

printf 'Athar release %s is ready for Passenger.\n' "$build_id"
