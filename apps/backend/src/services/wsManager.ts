import type { WebSocket } from "@fastify/websocket";

/** Carousel identifiers for home:update events. */
export type CarouselId = string;

/** Messages sent from the server to clients. */
export type WsServerMessage =
  | { type: "auth_ok" }
  | { type: "auth_error"; reason: string }
  | { type: "pong" }
  | { type: "home:update"; carousel: CarouselId; action: "refresh" }
  | { type: "notifications:update"; action: "refresh" };

/** Map of userId -> active WebSocket connections */
const connections = new Map<string, Set<WebSocket>>();

/** Debounce: max 1 event per (userId, carousel) per 5 seconds */
const DEBOUNCE_MS = 5_000;
const lastEmit = new Map<string, number>();

function shouldEmit(userId: string, carousel: string): boolean {
  const key = `${userId}:${carousel}`;
  const now = Date.now();
  const last = lastEmit.get(key) ?? 0;
  if (now - last < DEBOUNCE_MS) return false;
  lastEmit.set(key, now);
  return true;
}

/** Periodically clean stale debounce entries (every 5 min) */
setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [key, ts] of lastEmit) {
    if (ts < cutoff) lastEmit.delete(key);
  }
}, 5 * 60_000);

function send(ws: WebSocket, msg: WsServerMessage): void {
  if (ws.readyState === 1 /* OPEN */) {
    ws.send(JSON.stringify(msg));
  }
}

// ── Connection lifecycle ──

export function addConnection(userId: string, ws: WebSocket): void {
  let set = connections.get(userId);
  if (!set) {
    set = new Set();
    connections.set(userId, set);
  }
  set.add(ws);
}

export function removeConnection(userId: string, ws: WebSocket): void {
  const set = connections.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) connections.delete(userId);
}

// ── Broadcasting ──

/** Send a carousel refresh event to a specific user. */
export function broadcastToUser(userId: string, carousel: CarouselId): void {
  if (!shouldEmit(userId, carousel)) return;
  const set = connections.get(userId);
  if (!set) return;
  const msg: WsServerMessage = { type: "home:update", carousel, action: "refresh" };
  for (const ws of set) send(ws, msg);
}

/** Send a carousel refresh event to all connected users. */
export function broadcastAll(carousel: CarouselId): void {
  for (const [userId, set] of connections) {
    if (!shouldEmit(userId, carousel)) continue;
    const msg: WsServerMessage = { type: "home:update", carousel, action: "refresh" };
    for (const ws of set) send(ws, msg);
  }
}

/** Number of connected users (for health/debug). */
export function getConnectionCount(): number {
  let total = 0;
  for (const set of connections.values()) total += set.size;
  return total;
}
