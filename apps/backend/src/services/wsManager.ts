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
  /** Poussé à un appareil dont le jumelage vient d'être révoqué : la TV/le
   *  mobile doit se déconfigurer et revenir à l'écran de jumelage. */
  | { type: "session:revoked" }
  /** Snapshot de page reco reconstruit : le client refait sa requête en silence. */
  | { type: "reco:update" }
  | WtServerMessage;

/** Map of userId -> active WebSocket connections */
const connections = new Map<string, Set<WebSocket>>();

/** Map of device tokenHash -> its active WebSocket connection(s).
 *  Permet de cibler UNE seule socket d'appareil (TV appairée) à la révocation,
 *  sans toucher les autres appareils du même compte. Les tokens « user »
 *  (web/mobile connectés directement) y figurent aussi mais leur hash ne
 *  correspond à aucun pairedDevice, donc ils ne sont jamais ciblés. */
const deviceSockets = new Map<string, Set<WebSocket>>();

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

export function addConnection(userId: string, ws: WebSocket, tokenHash?: string): void {
  let set = connections.get(userId);
  if (!set) {
    set = new Set();
    connections.set(userId, set);
  }
  const wasOffline = set.size === 0;
  set.add(ws);
  if (wasOffline) emitPresence(userId, true);

  if (tokenHash) {
    let dset = deviceSockets.get(tokenHash);
    if (!dset) {
      dset = new Set();
      deviceSockets.set(tokenHash, dset);
    }
    dset.add(ws);
  }
}

export function removeConnection(userId: string, ws: WebSocket, tokenHash?: string): void {
  const set = connections.get(userId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) {
      connections.delete(userId);
      emitPresence(userId, false);
    }
  }

  if (tokenHash) {
    const dset = deviceSockets.get(tokenHash);
    if (dset) {
      dset.delete(ws);
      if (dset.size === 0) deviceSockets.delete(tokenHash);
    }
  }
}

/** Révocation d'un appareil appairé : pousse `session:revoked` à sa/ses
 *  socket(s) puis les ferme, forçant la TV/le mobile à se déconfigurer
 *  immédiatement (sinon la détection ne survient que passivement, au prochain
 *  échec d'auth — jamais si l'appareil reste inactif sur un écran en cache). */
export function revokeDeviceByTokenHash(tokenHash: string): void {
  const dset = deviceSockets.get(tokenHash);
  if (!dset) return;
  for (const ws of dset) {
    send(ws, { type: "session:revoked" });
    if (ws.readyState === 1 /* OPEN */) ws.close(4009, "Device revoked");
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
