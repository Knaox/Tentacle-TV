/**
 * Octave — l'envoi d'un évènement `music:*` à des COMPTES nommés, sur le
 * socket partagé `/api/ws` (comme `server:jellyfin`). Le cœur s'en sert pour
 * ses propres évènements ; le runtime des extensions (API d'hôte
 * `events.emit`) l'appelle pour `music:resolved` / `music:pending`, après
 * avoir vérifié le type (`PLUGIN_EMITTABLE_MUSIC_EVENTS`).
 *
 * Identifiants Jellyfin acceptés avec ou sans tirets. Rend le nombre de
 * comptes connectés qui l'ont reçu (un compte hors ligne relira en revenant :
 * `useMusicLive` rattrape au retour du socket).
 */

import { connectedUserIds, sendToUser } from "../../services/wsManager";
import type { MusicEvent } from "../contract/musicEvents";
import { normalizeId } from "../jellyfin/musicJellyfin";

/** Le message du socket : l'évènement, copié en objet simple (l'entrée `music:*` du socket). */
export function musicMessage(event: MusicEvent): { type: `music:${string}` } & Record<string, unknown> {
  return { ...event };
}

export function sendMusicEvent(userIds: readonly string[], event: MusicEvent): number {
  const wanted = new Set(userIds.map(normalizeId));
  let delivered = 0;
  for (const userId of connectedUserIds()) {
    if (!wanted.has(normalizeId(userId))) continue;
    sendToUser(userId, musicMessage(event));
    delivered++;
  }
  return delivered;
}

/** À tous les comptes connectés (`music:provider` : une extension est apparue ou a été coupée). */
export function broadcastMusicEvent(event: MusicEvent): number {
  const users = connectedUserIds();
  for (const userId of users) sendToUser(userId, musicMessage(event));
  return users.length;
}
