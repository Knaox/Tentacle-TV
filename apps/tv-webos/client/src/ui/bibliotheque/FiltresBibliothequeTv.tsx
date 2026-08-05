import type { ComponentProps } from "react";
import { LibraryFilterBar as BarreWeb } from "@/components/LibraryFilters";

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
 * `focus/defaut.ts` AVANT la première carte d'une grille, et le focus
 * d'arrivée sur une bibliothèque se poserait alors sur un filtre au lieu de
 * l'affiche — le défaut que ce module documente avoir corrigé.
 *
 * Le hook et le type sont réexportés tels quels : la substitution remplace le
 * MODULE, et ses autres exports doivent continuer d'exister pour
 * `LibraryGrid`.
 */

export { useLibraryFilters, CHIP_BASE } from "@/components/LibraryFilters";
export type { LibraryFilterState } from "@/components/LibraryFilters";

export function LibraryFilterBar(proprietes: ComponentProps<typeof BarreWeb>) {
  return (
    <div data-tv-zone="filtres-bibliotheque">
      <BarreWeb {...proprietes} />
    </div>
  );
}
