import { Radius } from "./colors";

/**
 * La forme d'un bouton ET l'anneau qui l'entoure, d'une seule source.
 *
 * Le rayon vivait en deux endroits : sur le fond du bouton, et — quand on y
 * pensait — sur le `focusRadius` du `Focusable`. On n'y pensait pas toujours :
 * l'anneau retombait alors sur son douze par défaut et dessinait des coins plus
 * carrés que le bouton, ce qui se voit surtout là où la forme est franche, sur
 * une pilule ou sur un rond.
 *
 * Une constante par forme, étalée des deux côtés, retire la question. Le
 * compilateur fait le reste : `Focusable` EXIGE désormais son rayon dès que la
 * variante est un bouton, si bien qu'un nouveau bouton ne peut plus naître sans
 * dire quelle forme il a.
 *
 * Les valeurs viennent de l'échelle du téléviseur (`TV_TOKENS.radius`, que la
 * LG écrit tel quel dans `tokens-tv.css`), jamais choisies au jugé.
 */
export const Bouton = {
  /** Les grands appels à l'action — Lecture, Reprendre, Plus d'infos. */
  grand: { borderRadius: Radius.buttonLarge },
  /** Les petites touches — clavier de recherche, bascules de langue. À cette
   *  taille, un rayon de page serait un galet. */
  petit: { borderRadius: Radius.small },
  /** Les boutons de page — réglages, menus, saisons, choix de langue. */
  moyen: { borderRadius: Radius.button },
  /** Les pilules — puces de filtre, recherches récentes, onglets. */
  pilule: { borderRadius: Radius.pill },
} as const;

/**
 * Un rond parfait de `taille` points — actions de fiche, boutons de l'OSD.
 *
 * C'est la forme où l'écart se voyait le plus : un anneau à douze autour d'un
 * disque de cinquante-six ne suit pas du tout son bord.
 */
export function boutonRond(taille: number) {
  return { width: taille, height: taille, borderRadius: taille / 2 } as const;
}
