#!/bin/sh
set -e

echo "[entrypoint] Waiting for database..."
node scripts/wait-for-db.mjs

if [ "${RUN_DB_PUSH:-true}" = "true" ]; then
  echo "[entrypoint] Syncing database schema..."
  npm run db:push
fi

echo "[entrypoint] Starting NMS API..."
exec npm start
