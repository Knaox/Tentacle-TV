import type { WebSocket } from "@fastify/websocket";
import { invalidateByCarousel } from "./jellyfinCache";
import type { WtServerMessage } from "./watchTogether/protocol";

/** Carousel identifiers for home:update events. */
export type CarouselId = string;

/** Messages sent from the server to clients.
 *  `pong` porte optionnellement l'echo `t` du ping client et `serverTime`
 *  (Date.now() serveur) — utilisés par Watch Together pour l'offset d'horloge. */
export type WsServerMessage =
  | { type: "auth_ok" }
  | { type: "auth_error"; reason: string }
  | { type: "pong"; t?: number; serverTime?: number }
  | { type: "home:update"; carousel: CarouselId; action: "refresh" }
  | { type: "notifications:update"; action: "refresh" }
  | WtServerMessage;

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

// ── Presence (Watch Together) ──

export type PresenceListener = (userId: string, online: boolean) => void;
const presenceListeners: PresenceListener[] = [];

/** Notifié quand un utilisateur passe 0→1 connexion (online) ou 1→0 (offline). */
export function onPresenceChange(listener: PresenceListener): void {
  presenceListeners.push(listener);
}

function emitPresence(userId: string, online: boolean): void {
  for (const l of presenceListeners) {
    try {
      l(userId, online);
    } catch (err) {
      console.error("[wsManager] presence listener error:", err);
    }
  }
}

export function isUserOnline(userId: string): boolean {
  return (connections.get(userId)?.size ?? 0) > 0;
}

// ── Connection lifecycle ──

export function addConnection(userId: string, ws: WebSocket): void {
  let set = connections.get(userId);
  if (!set) {
    set = new Set();
    connections.set(userId, set);
  }
  const wasOffline = set.size === 0;
  set.add(ws);
  if (wasOffline) emitPresence(userId, true);
}

export function removeConnection(userId: string, ws: WebSocket): void {
  const set = connections.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) {
    connections.delete(userId);
    emitPresence(userId, false);
  }
}

// ── Broadcasting ──

/** Send a carousel refresh event to a specific user.
 *  Invalide aussi le cache backend des routes Jellyfin associées — sinon le
 *  refetch déclenché par le client retomberait sur une réponse cachée stale. */
export function broadcastToUser(userId: string, carousel: CarouselId): void {
  invalidateByCarousel(carousel);
  if (!shouldEmit(userId, carousel)) return;
  const set = connections.get(userId);
  if (!set) return;
  const msg: WsServerMessage = { type: "home:update", carousel, action: "refresh" };
  for (const ws of set) send(ws, msg);
}

/** Send a carousel refresh event to all connected users.
 *  Invalide aussi le cache backend (toutes plateformes vont refetch — autant
 *  ne pas leur servir une version stale). */
export function broadcastAll(carousel: CarouselId): void {
  invalidateByCarousel(carousel);
  for (const [userId, set] of connections) {
    if (!shouldEmit(userId, carousel)) continue;
    const msg: WsServerMessage = { type: "home:update", carousel, action: "refresh" };
    for (const ws of set) send(ws, msg);
  }
}

/** Envoi direct d'un message arbitraire à toutes les connexions d'un user.
 *  Contrairement à broadcastToUser : pas de debounce, pas d'invalidation de
 *  cache — utilisé par Watch Together (états de room, invitations). */
export function sendToUser(userId: string, msg: WsServerMessage): void {
  const set = connections.get(userId);
  if (!set) return;
  for (const ws of set) send(ws, msg);
}

/** Number of connected users (for health/debug). */
export function getConnectionCount(): number {
  let total = 0;
  for (const set of connections.values()) total += set.size;
  return total;
}
