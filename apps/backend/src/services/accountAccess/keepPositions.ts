/**
 * La position de lecture d'un compte qu'on vient de BLOQUER (docs/DROITS-UTILISATEURS.md
 * § 9.1) : la lecture est coupée sur-le-champ, et son rapport d'arrêt part avec le
 * jeton du compte — que Jellyfin refuse désormais (hors plage, 403 ; désactivé, jeton
 * révoqué). Mesuré sur 10.11.11 : la position était perdue, « Reprendre » vide.
 * Avant la fermeture, elle est donc écrite au nom du compte par la clé
 * d'administration (`POST /UserItems/{id}/UserData?userId=`), que les plages ne
 * bornent pas : à la réouverture, le titre reprend où il s'était arrêté.
 */

import { jellyfinAdminFetch } from "../jellyfinAdminFetch";
import { sessionConnections } from "../deviceSessions/gateway";

const keyOf = (id: string) => id.replace(/-/g, "").toLowerCase();

export async function keepPlaybackPositions(userId: string, now = Date.now()): Promise<number> {
  const playing = sessionConnections().filter((view) => keyOf(view.userId) === keyOf(userId) && view.playback);
  const writes = playing.map((view) =>
    jellyfinAdminFetch(`/UserItems/${encodeURIComponent(view.playback!.itemId)}/UserData?userId=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: { PlaybackPositionTicks: view.playback!.positionTicks, LastPlayedDate: new Date(now).toISOString() },
    }).then((result) => result.ok),
  );
  return (await Promise.all(writes)).filter(Boolean).length;
}
