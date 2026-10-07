import { broadcastAll, broadcastToUser } from "./wsManager";
import { poke as pokeLibraryAdded } from "./libraryAddedNotifier";
import { pokeProfile } from "./reco/jobs";
import { refreshLibraryMemo } from "./reco/candidates/libraryMemo";
import { markCatalogChanged } from "./search/catalog";
import { markAllUserAccessStale, refreshUserAccess } from "./search/userAccess";

/**
 * Ce que Jellyfin pousse aux sessions d'UTILISATEUR, relayé aux applications.
 *
 * Jellyfin n'envoie `LibraryChanged` et `UserDataChanged` qu'aux sessions
 * d'un compte (`LibraryChangedNotifier`, `UserDataChangeNotifier`, 10.11) :
 * la socket du serveur, ouverte par la clé d'API, n'en reçoit aucun. Celles
 * des APPAREILS, si — le canal de session en tient une par appareil connecté,
 * au nom de son compte (`deviceSessions/deviceSocket.ts`). Pour Jellyfin,
 * c'est l'utilisateur qui écoute : aucune connexion de plus, aucune requête
 * au repos.
 *
 * - `LibraryChanged` part ~`LibraryUpdateDuration` (30 s par défaut, réglage
 *   conseillé : 5 s) après le dernier changement : la création d'un titre et
 *   ses métadonnées arrivent ensemble, la carte entre avec son affiche.
 * - `UserDataChanged` (vu, favori, note, début et fin de lecture — jamais la
 *   progression, filtrée par Jellyfin) part ~0,5 s après.
 *
 * Plusieurs appareils connectés reçoivent le même évènement au même instant :
 * il n'est relayé qu'une fois (`DUPLICATE_MS`). Un ajout se dit à TOUS les
 * comptes connectés — un compte sans accès à la bibliothèque relit ses
 * rangées pour rien, sans rien apprendre — y compris ceux dont l'application,
 * plus ancienne, n'ouvre pas de canal de session.
 */

/** Les copies d'un même évènement (un par appareil connecté) tombent dans cette fenêtre. */
const DUPLICATE_MS = 2_000;

let lastLibraryAt = 0;
const lastUserDataAt = new Map<string, number>();

/** Les titres ajoutés que dit l'évènement — pour le journal. */
function addedCount(data: unknown): number {
  const added = (data as { ItemsAdded?: unknown } | null)?.ItemsAdded;
  return Array.isArray(added) ? added.length : 0;
}

export function relayLibraryChanged(data: unknown, now = Date.now()): void {
  if (now - lastLibraryAt < DUPLICATE_MS) return;
  lastLibraryAt = now;
  console.log(`[JellyfinEvents] bibliothèque changée (+${addedCount(data)}) → rangées « Derniers ajouts »`);
  broadcastAll("recently_added");
  // Les notifications d'ajout font leur diff tout de suite, le moteur de
  // recherche relève ce qui a changé (une fois par salve), et les droits des
  // comptes se relèveront à leur prochaine recherche.
  pokeLibraryAdded();
  markCatalogChanged();
  markAllUserAccessStale();
}

export function relayUserDataChanged(data: unknown, now = Date.now()): void {
  const userId = (data as { UserId?: unknown } | null)?.UserId;
  if (typeof userId !== "string" || userId === "") return;
  if (now - (lastUserDataAt.get(userId) ?? 0) < DUPLICATE_MS) return;
  lastUserDataAt.set(userId, now);
  for (const carousel of ["watched", "watchlist", "favorites", "continue_watching"]) broadcastToUser(userId, carousel);
  // Un favori, un titre terminé : le mémo de bibliothèque se rafraîchit en
  // fond, le profil de goût de CE compte se reconstruit (débouncé côté jobs),
  // et sa recherche reflète vu / en cours / favori.
  refreshLibraryMemo(userId);
  pokeProfile(userId);
  refreshUserAccess(userId);
}

/** Pour les tests : oublier les évènements déjà relayés. */
export function resetJellyfinUserEventsForTests(): void {
  lastLibraryAt = 0;
  lastUserDataAt.clear();
}
