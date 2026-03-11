#!/bin/sh
set -e

# --- 1. Load DATABASE_URL from data/database.json if not in env ---
if [ -z "$DATABASE_URL" ]; then
  if [ -f data/database.json ]; then
    DB_URL=$(node -e "
      try {
        const cfg = JSON.parse(require('fs').readFileSync('data/database.json', 'utf8'));
        if (cfg.url) process.stdout.write(cfg.url);
      } catch {}
    " 2>/dev/null)

    if [ -n "$DB_URL" ]; then
      export DATABASE_URL="$DB_URL"
      echo "[Entrypoint] DATABASE_URL loaded from data/database.json"
    fi
  fi
fi

# --- 2. Refresh shared-deps from image seed ---
if [ -d /app/shared-deps-seed ]; then
  mkdir -p data/shared-deps
  cp -f /app/shared-deps-seed/* data/shared-deps/ 2>/dev/null || true
  echo "[Entrypoint] Shared deps updated from image"
fi

# --- 3. DB wait + migrations, or setup mode ---
if [ -n "$DATABASE_URL" ]; then
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
    echo "[Entrypoint] ERROR: Database not reachable after $MAX_RETRIES attempts. Starting server anyway."
  else
    echo "[Entrypoint] Running database migrations..."
    npx prisma db push || echo "[Entrypoint] WARNING: Migration failed — server will start in setup mode."
  fi
else
  echo "[Entrypoint] No DATABASE_URL — starting in setup mode"
fi

echo "[Entrypoint] Starting Tentacle server..."
exec node dist/index.js
