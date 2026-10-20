import type { WtElsewhereDto, WtInviteDto, WtRoomStateDto } from "@tentacle-tv/shared";
import type { SocketStatus } from "../../socket/tentacleSocket";

/**
 * Watch Together après une REconnexion de la socket — la même règle pour le
 * web, le bureau et le mobile.
 *
 * Le serveur tient en mémoire les salles, les invitations, l'avis « groupe en
 * cours sur un autre appareil » ; un redémarrage (une mise à jour) les efface,
 * et la socket ne redit rien de ce qui a disparu. Avant, seule une séance qui
 * se croyait dans une salle redemandait son état (`wt:syncRequest`, purgé sur
 * `not_in_group`) : l'avis « Rejoindre ici » d'une salle disparue restait —
 * POST join-here en 409 (constat du 21/10) —, comme des invitations mortes et
 * un accès jamais relu. Désormais, à chaque REconnexion, ce que la socket ne
 * redira pas se relit par REST ; la première ouverture n'en a pas besoin (le
 * démarrage de la séance vient de tout lire).
 */

/** L'écouteur de statut de la socket : `onOpen(reconnected)` à chaque ouverture,
 *  `reconnected` vrai pour toutes sauf la première. */
export function watchReconnects(onOpen: (reconnected: boolean) => void): (status: SocketStatus) => void {
  let seenOpen = false;
  return (status) => {
    if (status !== "open") return;
    onOpen(seenOpen);
    seenOpen = true;
  };
}

export interface WtResyncDeps {
  /** La séance se croit-elle dans une salle ? (la socket la relit : `wt:syncRequest`) */
  inRoom: () => boolean;
  mayJoin: boolean;
  /** Le serveur déclare `watchTogether.deviceMembership` (l'avis « ailleurs » existe). */
  deviceMembership: boolean;
  fetchMyGroup: () => Promise<WtRoomStateDto | null>;
  fetchMyInvites: () => Promise<WtInviteDto[]>;
  fetchGroupElsewhere: () => Promise<WtElsewhereDto | null>;
  setRoom: (room: WtRoomStateDto) => void;
  setInvites: (invites: WtInviteDto[]) => void;
  setElsewhere: (elsewhere: WtElsewhereDto | null) => void;
  /** Relire l'accès du compte (`/access`) : il a pu changer pendant la coupure. */
  refreshAccess: () => void;
}

/** Relit ce que la socket ne redira pas ; jamais une exception (un échec réseau garde l'état). */
export async function resyncAfterReconnect(deps: WtResyncDeps): Promise<void> {
  deps.refreshAccess();
  if (!deps.mayJoin) return;
  const reads: Array<Promise<unknown>> = [deps.fetchMyInvites().then(deps.setInvites)];
  if (!deps.inRoom()) {
    // Un appareil lié à une salle que la séance ignorait (réponse perdue pendant la coupure).
    reads.push(deps.fetchMyGroup().then((room) => {
      if (room && !deps.inRoom()) deps.setRoom(room);
    }));
    if (deps.deviceMembership) {
      reads.push(deps.fetchGroupElsewhere().then((found) => {
        if (!deps.inRoom()) deps.setElsewhere(found);
      }));
    }
  }
  await Promise.allSettled(reads);
}
