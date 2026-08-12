#!/bin/sh
set -eu

APP_ROOT=/home/athar/apps/athar-ai
RUNTIME_ROOT="$APP_ROOT/.next/standalone"
PID_FILE="$APP_ROOT/.athar-server.pid"
LOG_FILE=/home/athar/logs/athar-app.log
NODE=/opt/cpanel/ea-nodejs22/bin/node
HEALTH_URL=http://127.0.0.1:3100/api/health

mkdir -p /home/athar/logs

healthy() {
  curl --fail --silent --max-time 5 "$HEALTH_URL" >/dev/null 2>&1
}

if healthy; then
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
HOSTNAME=127.0.0.1 PORT=3100 NODE_ENV=production \
  nohup "$NODE" server.js >>"$LOG_FILE" 2>&1 </dev/null &
echo "$!" >"$PID_FILE"

sleep 2
healthy
