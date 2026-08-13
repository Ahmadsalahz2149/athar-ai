#!/bin/sh
set -eu

APP_ROOT=/home/athar/apps/athar-ai
RUNTIME_ROOT="$APP_ROOT/.next/standalone"
PID_FILE="$APP_ROOT/.athar-server.pid"
LOG_FILE=/home/athar/logs/athar-app.log
NODE=/opt/cpanel/ea-nodejs22/bin/node
APP_PORT=${ATHAR_APP_PORT:-3101}
HEALTH_URL="http://127.0.0.1:${APP_PORT}/api/health"
BUILD_ID_FILE="$RUNTIME_ROOT/.next/BUILD_ID"
RUNNING_BUILD_FILE="$APP_ROOT/.athar-running-build"

mkdir -p /home/athar/logs

healthy() {
  curl --fail --silent --max-time 5 "$HEALTH_URL" >/dev/null 2>&1
}

current_build=$(cat "$BUILD_ID_FILE")
running_build=$(cat "$RUNNING_BUILD_FILE" 2>/dev/null || true)

# A healthy process may still be serving an older build after a deployment.
# Only keep it when it is running the exact build currently on disk.
if healthy && [ "$running_build" = "$current_build" ]; then
  exit 0
fi

if [ -f "$PID_FILE" ]; then
  old_pid=$(cat "$PID_FILE" 2>/dev/null || true)
  case "$old_pid" in
    ''|*[!0-9]*) ;;
    *)
      if kill -0 "$old_pid" 2>/dev/null; then
        kill "$old_pid" 2>/dev/null || true
        sleep 1
      fi
      ;;
  esac
fi

cd "$RUNTIME_ROOT"
umask 077
HOSTNAME=127.0.0.1 PORT="$APP_PORT" NODE_ENV=production \
  nohup "$NODE" server.js >>"$LOG_FILE" 2>&1 </dev/null &
echo "$!" >"$PID_FILE"

sleep 2
healthy
printf '%s\n' "$current_build" >"$RUNNING_BUILD_FILE"
