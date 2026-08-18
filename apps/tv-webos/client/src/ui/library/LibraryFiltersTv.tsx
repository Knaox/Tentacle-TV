import { useEffect, useRef, type ComponentProps } from "react";
import { useLocation } from "react-router-dom";
import { LibraryFilterBar as BarreWeb } from "@/components/LibraryFilters";
// Le hook et son état ont quitté le composant pour `hooks/` côté web : la
// substitution est un greffon de build, `tsc` ne la connaît pas, et c'est ce
// import-ci qui casse quand `apps/web` se réorganise.
import { useLibraryFilters as useLibraryFiltersWeb } from "@/hooks/useLibraryFilters";
import { filtresRetenus, rejouerFiltres, retenirFiltres } from "./filtersMemory";

/**
 * La barre de filtres d'une bibliothèque, déclarée comme ZONE.
 *
 * Y entrer par le bas — depuis la première affiche — visait la pastille dont
 * l'abscisse tombait sous la carte quittée, jamais le filtre en cours. On
 * remontait donc dans la barre sans savoir où l'on atterrissait, et le filtre
 * actif, qui est ce qu'on vient vérifier ou changer, pouvait être à l'autre
 * bout.
 *
 * L'enveloppe ne fait que poser le marqueur : la destination se résout seule
 * sur `aria-selected="true"`, que les pastilles portent depuis qu'on l'a
 * ajouté côté web — un état qui n'était jusque-là lisible que dans la couleur,
 * donc pour personne d'autre qu'un œil.
 *
 * `aria-selected` et pas `aria-current` : ce dernier est consulté par
 * `focus/default.ts` AVANT la première carte d'une grille, et le focus
 * d'arrivée sur une bibliothèque se poserait alors sur un filtre au lieu de
 * l'affiche — le défaut que ce module documente avoir corrigé.
 *
 * Le hook et le type sont réexportés tels quels : la substitution remplace le
 * MODULE, et ses autres exports doivent continuer d'exister pour
 * `LibraryGrid`.
 */

export { CHIP_BASE } from "@/components/LibraryFilters";
export type { LibraryFilterState } from "@/hooks/useLibraryFilters";

/**
 * Les filtres survivent à un aller-retour vers une fiche.
 *
 * Le hook du web n'est qu'un `useState` : ouvrir un média puis revenir démonte
 * la grille et les filtres avec elle. Sur un écran d'ordinateur cela se
 * remarque peu ; à la télécommande, entrer et sortir d'une fiche est LE geste
 * de base, et l'on reposait ses trois filtres à chaque retour.
 *
 * L'enveloppe ne change rien au hook — elle mémorise ce qu'il publie, et le lui
 * raconte au montage suivant. Voir `filtersMemory.ts` pour le pourquoi de
 * chaque choix.
 */
export function useLibraryFilters() {
  const commandes = useLibraryFiltersWeb();
  const { pathname } = useLocation();

  // Les commandes changent d'identité à chaque rendu : les lire dans une ref
  // évite de relancer la restauration à chacun d'eux.
  const vives = useRef(commandes);
  vives.current = commandes;

  const restaure = useRef("");

  useEffect(() => {
    if (restaure.current === pathname) return;
    restaure.current = pathname;
    const garde = filtresRetenus(pathname);
    if (garde) rejouerFiltres(vives.current, garde);
  }, [pathname]);

  useEffect(() => {
    // Pas avant d'avoir restauré : on écraserait la mémoire avec l'état par
    // défaut du premier rendu, c'est-à-dire avec rien.
    if (restaure.current !== pathname) return;
    retenirFiltres(pathname, commandes.filters);
  }, [pathname, commandes.filters]);

  return commandes;
}

export function LibraryFilterBar(proprietes: ComponentProps<typeof BarreWeb>) {
  return (
    <div data-tv-zone="filtres-bibliotheque">
      <BarreWeb {...proprietes} />
    </div>
  );
}
