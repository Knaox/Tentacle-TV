/**
 * Après une suppression, ce que le SERVEUR gardait de ces titres tombe tout de suite.
 *
 * Jellyfin finira par dire `LibraryChanged` (~`LibraryUpdateDuration` plus tard, et
 * seulement si une application a sa socket ouverte) : sans attendre, la recherche,
 * les recos et la saga oublient les titres (relevés des comptes), les verdicts de
 * visibilité et les rangées gardées par le proxy (Derniers ajouts, Reprendre,
 * Prochains épisodes) tombent, et chaque application connectée relit ses rangées.
 */

import { broadcastAll } from "../wsManager";
import { markCatalogChanged } from "../search/catalog";
import { dropItemsFromUserAccess } from "../search/userAccess";
import { invalidateItemVisibility } from "../itemAccess/itemVisibility";

/** Les rangées qu'un titre supprimé peut occuper — chacune vide aussi sa part du cache du proxy. */
const CAROUSELS = ["recently_added", "continue_watching", "next_up", "watchlist", "favorites", "watched"] as const;

export function afterLibraryDeletion(deletedIds: readonly string[]): void {
  if (deletedIds.length === 0) return;
  dropItemsFromUserAccess(deletedIds);
  invalidateItemVisibility();
  markCatalogChanged();
  for (const carousel of CAROUSELS) broadcastAll(carousel);
}
