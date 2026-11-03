#!/bin/sh
set -eu
cd /app
if [ ! -d node_modules/argon2 ]; then
  npm ci
fi
npx prisma generate
npx prisma migrate deploy
npx tsc -p tsconfig.json --pretty false

npx tsc -p tsconfig.json --pretty false --watch --preserveWatchOutput &
TSC_PID=$!

node --watch dist/index.js &
NODE_PID=$!

terminate() {
  kill -TERM "$NODE_PID" 2>/dev/null || true
  kill -TERM "$TSC_PID" 2>/dev/null || true
  wait "$NODE_PID" 2>/dev/null || true
  wait "$TSC_PID" 2>/dev/null || true
  exit 0
}

trap terminate TERM INT
wait "$NODE_PID"
STATUS=$?
kill -TERM "$TSC_PID" 2>/dev/null || true
wait "$TSC_PID" 2>/dev/null || true
exit "$STATUS"
