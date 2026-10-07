import { broadcastAll } from "./wsManager";
import { pokeWatchTime } from "./watchTime/collector";
import { relayLibraryChanged, relayUserDataChanged } from "./jellyfinUserEvents";

/**
 * Les évènements que Jellyfin pousse vers les SESSIONS UTILISATEUR —
 * bibliothèque, données d'un compte, lecture. Une socket ouverte avec une clé
 * d'API n'en reçoit aucun (cf. l'en-tête de `jellyfinWs.ts`) : ces branches
 * sont un filet. Le direct passe par les sockets des appareils, ouvertes au
 * nom de leur compte (`jellyfinUserEvents.ts`). Sorties de `jellyfinWs.ts`,
 * qui dépassait la taille d'un fichier.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handleServerEvent(type: string, data: any): void {
  switch (type) {
    // Les mêmes relais que les sockets d'appareil (`jellyfinUserEvents.ts`) :
    // une seule règle, d'où que vienne l'évènement.
    case "LibraryChanged":
      relayLibraryChanged(data);
      break;
    case "UserDataChanged":
      relayUserDataChanged(data);
      break;
    case "PlaybackStart":
    case "PlaybackStopped":
      broadcastAll("continue_watching");
      broadcastAll("next_up");
      pokeWatchTime();
      break;
    // Le contenu de ces messages n'est JAMAIS lu : ils ne servent que de
    // sonnette au collecteur, qui va relever les sessions lui-même. Une
    // mesure ne doit pas dépendre d'une source qui peut mentir ou manquer.
    case "PlaybackProgress":
      pokeWatchTime();
      break;
  }
}
