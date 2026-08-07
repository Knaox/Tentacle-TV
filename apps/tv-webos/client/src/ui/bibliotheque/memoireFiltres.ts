import type { LibraryFilterState } from "@/components/LibraryFilters";

/**
 * Les filtres d'une bibliothèque, gardés le temps d'un aller-retour.
 *
 * `useLibraryFilters` n'est qu'un `useState` : l'état meurt avec le composant.
 * Sur un écran d'ordinateur cela se remarque peu — on ouvre une fiche dans un
 * onglet, ou l'on revient par le bouton du navigateur, qui recharge la page de
 * toute façon. À la télécommande, ouvrir une fiche puis revenir est LE geste de
 * base : on parcourt une bibliothèque en entrant et sortant vingt fois. Perdre
 * les filtres à chaque retour rend le tri inutilisable.
 *
 * Le portage restaure déjà le focus et le défilement d'une grille quittée ; sans
 * les filtres, cette restauration désigne d'ailleurs une position dans une liste
 * qui n'est plus la même.
 *
 * **Hors de React, volontairement.** C'est ce qui permet à la mémoire de
 * survivre au démontage de la page — le contraire d'un `useState`, et le même
 * motif que le magasin du lecteur.
 *
 * **Par bibliothèque**, la clé étant le chemin : deux bibliothèques n'ont ni les
 * mêmes genres ni le même tri, et rapporter les filtres de l'une sur l'autre
 * afficherait une grille vide sans qu'on sache pourquoi.
 *
 * La mémoire ne survit pas au rechargement de l'application, et c'est voulu :
 * retrouver au démarrage un filtre posé la veille, sans se rappeler l'avoir
 * posé, se lit comme une bibliothèque à moitié vide.
 */

const memoire = new Map<string, LibraryFilterState>();

export function retenirFiltres(cle: string, filtres: LibraryFilterState): void {
  memoire.set(cle, filtres);
}

export function filtresRetenus(cle: string): LibraryFilterState | null {
  return memoire.get(cle) ?? null;
}

/** Les commandes de `useLibraryFilters` dont la restauration a besoin. */
export interface CommandesFiltres {
  filters: LibraryFilterState;
  toggleGenre: (id: string) => void;
  toggleStudio: (id: string) => void;
  togglePlatform: (id: number) => void;
  setYearFrom: (v: number | null) => void;
  setYearTo: (v: number | null) => void;
  setRatingMin: (v: number | null) => void;
  setStatusFilter: (v: string | null) => void;
  setIsFavorite: (v: boolean) => void;
  setSortBy: (v: string) => void;
  setSortOrder: (v: string) => void;
}

/**
 * Rejoue un état sur un hook fraîchement monté.
 *
 * Le hook du web n'accepte pas d'état initial — on ne peut donc pas lui donner
 * la mémoire, il faut la lui raconter. Les bascules partent d'une liste vide,
 * puisque le composant vient de naître : les appeler une fois par identifiant
 * les ajoute, sans avoir à remettre à zéro d'abord.
 *
 * Tout se passe dans un même effet, donc dans un seul lot React : la grille ne
 * voit qu'un état, et n'émet qu'une requête.
 */
export function rejouerFiltres(commandes: CommandesFiltres, garde: LibraryFilterState): void {
  garde.genreIds.forEach(commandes.toggleGenre);
  garde.studioIds.forEach(commandes.toggleStudio);
  garde.platformIds.forEach(commandes.togglePlatform);
  if (garde.yearFrom !== null) commandes.setYearFrom(garde.yearFrom);
  if (garde.yearTo !== null) commandes.setYearTo(garde.yearTo);
  if (garde.ratingMin !== null) commandes.setRatingMin(garde.ratingMin);
  if (garde.statusFilter !== null) commandes.setStatusFilter(garde.statusFilter);
  if (garde.isFavorite) commandes.setIsFavorite(true);
  commandes.setSortBy(garde.sortBy);
  commandes.setSortOrder(garde.sortOrder);
}
