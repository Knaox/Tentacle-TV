import { leaveGroup, setWatchTogetherToken } from "../../hooks/useWatchTogetherApi";
import { resetSocketSession, resumeSocketSession } from "../../socket/tentacleSocket";

/**
 * Watch Together face à une BASCULE DE SESSION sans rechargement (le mobile :
 * « Qui regarde ? » → un autre profil de la Famille, ou retour au compte).
 * Le web et le bureau rechargent la page : rien à faire pour eux.
 *
 * Sans cela, la socket partagée restait authentifiée au nom de l'ANCIENNE
 * session (le serveur ne ré-authentifie jamais une socket) : la salle créée
 * par le profil avait un hôte « hors ligne », et la socket recevait la salle
 * du compte de connexion. La séance suit donc la session, dans cet ordre :
 *
 * 1. l'ancienne session QUITTE sa salle, avec son propre jeton (le jeton
 *    REST de Watch Together n'a pas encore bougé) — jamais 120 s de grâce
 *    pendant lesquelles elle paraîtrait encore là ;
 * 2. le REST de Watch Together prend le nouveau jeton ;
 * 3. la socket se ferme et se rouvre au nom de la nouvelle session.
 */

let roomHeld = false;

/** La séance de l'appareil est-elle dans une salle (posé par `useWatchTogetherSession`) ? */
export function noteWtRoomHeld(held: boolean): void {
  roomHeld = held;
}

export function switchWtSession(nextToken: string | null): void {
  if (roomHeld) {
    roomHeld = false;
    // Les en-têtes partent à l'appel : c'est bien l'ancienne session qui quitte.
    void leaveGroup().catch(() => {});
  }
  setWatchTogetherToken(nextToken);
  resetSocketSession();
  if (nextToken) resumeSocketSession(nextToken);
}
