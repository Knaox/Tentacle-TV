import type { WebSocket } from "@fastify/websocket";

/**
 * Les sockets par APPAREIL — un appareil, c'est le hash du jeton qui a ouvert
 * la socket (`hashToken`). Sorti de `wsManager.ts` (plafond des 300 lignes) :
 * la révocation d'un jumelage y cible UNE socket d'appareil sans toucher les
 * autres appareils du compte, et Watch Together y lit l'adhésion par appareil
 * (1.32.0) : qui est en ligne, à quelles sockets parler, quand un appareil
 * passe en ligne ou hors ligne.
 *
 * Les jetons « personnels » (web, bureau, mobile connectés directement) y
 * figurent aussi : leur hash ne correspond à aucun jumelage, la révocation ne
 * les vise donc jamais — mais ils SONT des appareils pour Watch Together.
 */

const deviceSockets = new Map<string, Set<WebSocket>>();
/** Socket → hash de son jeton (l'appareil qui l'a ouverte). */
const socketDevice = new WeakMap<WebSocket, string>();

export type DevicePresenceListener = (userId: string, deviceKey: string, online: boolean) => void;
const devicePresenceListeners: DevicePresenceListener[] = [];

/** Notifié quand un appareil passe 0→1 socket (en ligne) ou 1→0 (hors ligne). */
export function onDevicePresenceChange(listener: DevicePresenceListener): void {
  devicePresenceListeners.push(listener);
}

function emitDevicePresence(userId: string, deviceKey: string, online: boolean): void {
  for (const listener of devicePresenceListeners) {
    try {
      listener(userId, deviceKey, online);
    } catch (err) {
      console.error("[wsManager] device presence listener error:", err);
    }
  }
}

export function bindDeviceSocket(userId: string, ws: WebSocket, tokenHash: string): void {
  let set = deviceSockets.get(tokenHash);
  if (!set) {
    set = new Set();
    deviceSockets.set(tokenHash, set);
  }
  const wasOffline = set.size === 0;
  set.add(ws);
  socketDevice.set(ws, tokenHash);
  if (wasOffline) emitDevicePresence(userId, tokenHash, true);
}

export function unbindDeviceSocket(userId: string, ws: WebSocket, tokenHash: string): void {
  const set = deviceSockets.get(tokenHash);
  if (!set || !set.delete(ws)) return;
  if (set.size === 0) {
    deviceSockets.delete(tokenHash);
    emitDevicePresence(userId, tokenHash, false);
  }
}

/** Les sockets ouvertes d'un appareil (vide s'il n'en a aucune). */
export function deviceSocketsOf(tokenHash: string): ReadonlySet<WebSocket> {
  return deviceSockets.get(tokenHash) ?? new Set();
}

export function isDeviceOnline(tokenHash: string): boolean {
  return (deviceSockets.get(tokenHash)?.size ?? 0) > 0;
}

/** L'appareil d'une socket authentifiée (undefined avant l'authentification). */
export function deviceKeyOfSocket(ws: WebSocket): string | undefined {
  return socketDevice.get(ws);
}
