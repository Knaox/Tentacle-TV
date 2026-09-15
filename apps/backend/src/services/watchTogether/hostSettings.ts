/**
 * Les réglages de lecture de l'hôte, portés par la salle.
 *
 * # Pourquoi le groupe suit l'hôte
 *
 * Une séance commune ne peut pas avoir deux comportements. Si l'hôte passe les
 * génériques tout seul et qu'un membre les garde, l'un des deux subit la
 * position de l'autre sans comprendre d'où elle vient — la synchronisation
 * fait de deux réglages contradictoires un défaut visible. C'est donc l'hôte
 * qui décide, pour tout le monde, le temps de la séance.
 *
 * # Ce qui n'est PAS fait, et c'est volontaire
 *
 * Les réglages du membre ne sont jamais écrits. Ils vivent dans son magasin,
 * l'override ne fait que passer devant, et ils reviennent intacts à la sortie
 * du groupe. Un invité ne repart pas avec les habitudes de son hôte.
 *
 * Le rafraîchissement est explicite, à trois moments seulement : création du
 * groupe, changement d'hôte (départ, grâce expirée, expulsion, départ implicite
 * en acceptant une autre invitation), et écriture des réglages PAR l'hôte. Aucune
 * lecture en base sur le chemin des diffusions — `roomToDto` reste synchrone.
 */

import { getRoomOf } from "./roomStore";
import type { Room } from "./roomStore";
import { broadcastRoom } from "./broadcast";
import { bumpEpoch } from "./sync";
import { readPlaybackSettings } from "../playbackSettingsService";
import { DEFAULT_PLAYBACK_SETTINGS } from "../../playback/playbackSettings";

/** Relit les réglages de l'hôte et les pose sur la salle. Un hôte qui n'a
 *  jamais rien réglé vit avec les défauts — ce sont donc les défauts qui
 *  gouvernent la salle, pas les réglages de chaque invité. Silencieux en cas
 *  d'échec de la base (`null` : chacun garde alors les siens) : un groupe doit
 *  vivre même sans base de réglages. */
export async function refreshHostSettings(room: Room): Promise<void> {
  try {
    room.hostSettings = (await readPlaybackSettings(room.hostUserId)) ?? DEFAULT_PLAYBACK_SETTINGS;
  } catch {
    room.hostSettings = null;
  }
}

/**
 * L'hôte vient de changer SES réglages : la salle les reprend et le groupe en
 * est informé. Sans effet si l'utilisateur n'héberge rien.
 */
export async function pushHostSettingsIfHosting(userId: string): Promise<void> {
  const room = getRoomOf(userId);
  if (!room || room.hostUserId !== userId) return;
  await refreshHostSettings(room);
  // L'epoch AVANCE : un état diffusé au même epoch est jeté comme périmé par
  // chaque client (garde anti-stale du réducteur) — la salle croyait alors
  // informer le groupe et personne n'entendait rien.
  bumpEpoch(room);
  broadcastRoom(room, "sync", userId);
}
