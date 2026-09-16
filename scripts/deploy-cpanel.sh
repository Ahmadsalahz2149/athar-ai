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

# Announce each phase. A step that is killed rather than failed prints nothing
# at all — which is how a deploy that died inside `drizzle-kit migrate` looked
# identical to one that finished it. The banner before each phase means the last
# line on screen always names the step that did not come back.
say() {
  printf '\n==> %s\n' "$1"
}

# Pin the temp directory for the WHOLE deploy, unconditionally.
#
# This account inherits TMPDIR from the server environment, pointing at another
# application's directory that the `athar` user cannot write. Anything that
# spills to temp then dies with EACCES — which is exactly how the first deploy
# that ran migrations from this script failed, at `drizzle-kit migrate`.
#
# It is an assignment, not a `${TMPDIR:-...}` default: a default only fills in
# an UNSET variable, and the problem here is a variable that is set to the wrong
# thing. ATHAR_TMPDIR is the deliberate override for an operator who wants a
# different location; the inherited value is never trusted.
TMPDIR="${ATHAR_TMPDIR:-$APP_ROOT/tmp}"
mkdir -p "$TMPDIR"
export TMPDIR

# Refuse to build without the server-only production configuration. Next.js
# also needs the NEXT_PUBLIC_* values while compiling browser bundles.
test -s .env.production

# A clean build is essential: merging two Turbopack outputs can leave HTML and
# the server runtime pointing at chunks that no longer exist.
rm -rf .next
say "installing dependencies"
"$NPM" ci

# Schema before code. Leaving migrations out of this script meant remembering a
# second command, in the right order, every single time — and the one time that
# order was wrong, a release went live reading columns that did not exist yet
# and two screens returned 500 until it was noticed. Running them here removes
# the step that has to be remembered.
#
# Safe to fail: `set -e` aborts the deploy before anything is staged or swapped,
# so the previous release keeps serving. Our migrations are additive first
# (a new column is invisible to the running code), which is what makes
# "migrate, then swap" the correct order rather than a gamble.
if [ "${ATHAR_SKIP_MIGRATE:-0}" = "1" ]; then
  printf 'Skipping migrations (ATHAR_SKIP_MIGRATE=1).\n'
else
  say "applying migrations"
  "$NPM" run db:migrate
fi

say "building"
"$NPM" run build

# Standalone does not copy these directories automatically. Assemble an
# immutable release outside .next, then switch the `current` symlink only when
# the release is complete. A failed future build cannot damage the live app.
say "staging the release"
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
say "switching to the new release"
ln -sfn "$release" "$APP_ROOT/current"

# Passenger is the only production process manager. It detects app.js and
# restarts the application after this timestamp changes.
touch "$APP_ROOT/current/tmp/restart.txt"

# Keep a few previous releases for a fast rollback, delete the rest.
#
# Nothing used to prune these, so every deploy left a complete standalone build
# behind for ever. On a cPanel account with a disk quota that ends one way: a
# deploy that dies part-way through copying, on a full disk, which is the worst
# moment to run out of room.
#
# Deliberately AFTER the symlink switch, and it never touches whatever `current`
# resolves to — a prune that could delete the running release would be a far
# worse bug than the one it fixes. Failures here are swallowed for the same
# reason: the release is already live, and housekeeping must not fail a
# successful deploy.
prune_releases() {
  keep="${ATHAR_KEEP_RELEASES:-3}"
  live=$(readlink "$APP_ROOT/current" 2>/dev/null || echo "")

  # Staging directories from a deploy that died before the move. These are
  # never the live release — `current` only ever points at a finished one.
  find "$RELEASES_ROOT" -maxdepth 1 -name '.*.tmp.*' -type d -mmin +60 -exec rm -rf {} + 2>/dev/null || true

  kept=0
  for dir in $(ls -1dt "$RELEASES_ROOT"/*/ 2>/dev/null); do
    dir=${dir%/}
    # Test the BASENAME. The releases root is itself a dot-directory, so a
    # pattern against the whole path matches every entry and prunes nothing —
    # which is how the first version of this silently did nothing at all.
    case "$(basename "$dir")" in .*) continue ;; esac
    if [ "$dir" = "$live" ]; then
      continue                              # the running release is never a candidate
    fi
    kept=$((kept + 1))
    if [ "$kept" -ge "$keep" ]; then
      rm -rf "$dir" 2>/dev/null || true
    fi
  done
}
prune_releases || true

printf 'Athar release %s is ready for Passenger.\n' "$build_id"
