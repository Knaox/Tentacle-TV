#!/bin/sh
set -e

echo "[Entrypoint] Waiting for database to be ready..."

MAX_RETRIES=10
RETRY_INTERVAL=2
attempt=1

while [ "$attempt" -le "$MAX_RETRIES" ]; do
  if node -e "
    const url = process.env.DATABASE_URL || '';
    const match = url.match(/@([^:]+):(\d+)/);
    if (!match) { process.exit(1); }
    const net = require('net');
    const sock = net.createConnection({ host: match[1], port: Number(match[2]), timeout: 2000 });
    sock.on('connect', () => { sock.destroy(); process.exit(0); });
    sock.on('error', () => process.exit(1));
    sock.on('timeout', () => { sock.destroy(); process.exit(1); });
  " 2>/dev/null; then
    echo "[Entrypoint] Database is reachable (attempt $attempt/$MAX_RETRIES)"
    break
  fi

  echo "[Entrypoint] Database not ready (attempt $attempt/$MAX_RETRIES) — retrying in ${RETRY_INTERVAL}s..."
  sleep "$RETRY_INTERVAL"
  attempt=$((attempt + 1))
done

if [ "$attempt" -gt "$MAX_RETRIES" ]; then
  echo "[Entrypoint] ERROR: Database not reachable after $MAX_RETRIES attempts. Starting server anyway (setup mode)."
fi

echo "[Entrypoint] Running database migrations..."
npx prisma db push --accept-data-loss || echo "[Entrypoint] WARNING: Migration failed — server will start in setup mode."

echo "[Entrypoint] Starting Tentacle server..."
exec node dist/index.js
