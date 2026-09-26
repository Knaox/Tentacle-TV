import { navigationRef } from "../../navigation/navigationRef";

/**
 * Revenir à la barre de recherche — parité LG (`returnToSearchBar`).
 *
 * Le rail reste visible sur une étagère de la recherche (acteur, genre,
 * studio), et « Rechercher » y est l'entrée active : la choisir ne doit pas
 * être un geste mort. Depuis l'étagère, on revient à la recherche — c'est
 * elle qui rend alors sa barre en reprenant le focus (`SearchScreen`), comme
 * au bouton Retour et à la touche Retour. Depuis la recherche elle-même, sa
 * barre reprend le focus tout de suite.
 *
 * La recherche montée inscrit ici le geste qui vise sa barre : le rail n'a
 * pas de référence vers elle, et n'a pas à savoir que la barre n'est pas
 * focalisable sur Android TV.
 */
let focusBar: (() => void) | null = null;

export function registerSearchBar(handler: () => void): () => void {
  focusBar = handler;
  return () => {
    if (focusBar === handler) focusBar = null;
  };
}

/** Rend vrai si le geste a été pris — la recherche ou son étagère est à l'écran. */
export function returnToSearchBar(): boolean {
  if (!navigationRef.isReady()) return false;
  const current = navigationRef.getCurrentRoute()?.name;
  if (current === "SearchBrowse") {
    navigationRef.goBack();
    return true;
  }
  if (current === "Search" && focusBar) {
    focusBar();
    return true;
  }
  return false;
}
