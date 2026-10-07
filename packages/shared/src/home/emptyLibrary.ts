import type { LibraryView } from "../types/media";

/** Les bibliothèques dont le décompte `RecursiveItemCount` vaut les films et séries (`useLibraries`). */
const VIDEO_COLLECTIONS = new Set(["movies", "tvshows", "mixed", "boxsets"]);

/**
 * Le compte n'a AUCUN titre à montrer : l'accueil le dit (« ajoutez des films
 * ou des séries ») au lieu d'un écran noir — la bannière et les rangées
 * vides ne rendent rien. `false` tant que les bibliothèques ne sont pas
 * connues : jamais l'état vide pendant un chargement.
 *
 * Une bibliothèque vidéo compte par `RecursiveItemCount` (films et séries,
 * relu par `useLibraries`) ; une autre (musique, photos, livres) par son
 * `ChildCount`, que le filtre films/séries mettrait à zéro à tort. Un
 * décompte inconnu ne vaut jamais « vide ».
 */
export function libraryHasNoTitles(libraries: readonly LibraryView[] | undefined): boolean {
  if (!libraries) return false;
  return libraries.every((library) => {
    const video = !library.CollectionType || VIDEO_COLLECTIONS.has(library.CollectionType);
    const count = video ? library.RecursiveItemCount ?? library.ChildCount : library.ChildCount;
    return count === 0;
  });
}
