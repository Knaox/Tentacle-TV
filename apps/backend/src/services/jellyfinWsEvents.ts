import { broadcastAll } from "./wsManager";
import { poke as pokeLibraryAdded } from "./libraryAddedNotifier";
import { pokeWatchTime } from "./watchTime/collector";
import { pokeProfile } from "./reco/jobs";
import { refreshLibraryMemo } from "./reco/candidates/libraryMemo";
import { markCatalogChanged } from "./search/catalog";
import { markAllUserAccessStale, refreshUserAccess } from "./search/userAccess";

/**
 * Les évènements que Jellyfin pousse vers les SESSIONS UTILISATEUR —
 * bibliothèque, données d'un compte, lecture. Une socket ouverte avec une clé
 * d'API n'en reçoit aucun (cf. l'en-tête de `jellyfinWs.ts`) : ces branches
 * sont un filet, au cas où la connexion viendrait un jour d'un jeton
 * utilisateur. Sorties de `jellyfinWs.ts`, qui dépassait la taille d'un fichier.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handleServerEvent(type: string, data: any): void {
  switch (type) {
    case "LibraryChanged":
      broadcastAll("recently_added");
      broadcastAll("featured");
      // Accélère la détection + fournit les IDs exacts des ajouts (pour titrer
      // la notif, même si la date n'est pas fiable). Poll aussi périodiquement.
      pokeLibraryAdded(data?.ItemsAdded);
      // Le moteur de recherche relève ce qui a changé (une fois par salve de
      // scan), et les droits des comptes se relèveront à leur recherche.
      markCatalogChanged();
      markAllUserAccessStale();
      break;
    case "UserDataChanged":
      broadcastAll("watchlist");
      broadcastAll("watched");
      // Un favori posé, un titre terminé… : le mémo de bibliothèque se
      // rafraîchit EN FOND (l'index courant reste servi, jamais de scan
      // dans une requête) et le profil de goût de CE compte se reconstruit
      // (débouncé 8 s côté jobs — une salve ne coûte qu'un rebuild).
      refreshLibraryMemo(data?.UserId ?? "");
      pokeProfile(data?.UserId);
      // Vu, en cours, favori : la recherche de CE compte les reflète.
      refreshUserAccess(data?.UserId ?? "");
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
