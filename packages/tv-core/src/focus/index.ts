/** Le focus : la géométrie du déplacement au D-pad, et les DÉCISIONS de focus
 * que les plateformes appliquent.
 *
 * Seule la géométrie est ici pour le moteur : celui qui parcourt le DOM reste
 * dans la cible webOS ; Apple TV et Android TV résolvent nativement le
 * déplacement du focus. Ce que la plateforme applique, ce dossier le décide :
 *
 * - `sections.ts` : HAUT / BAS entre sections (la section voisine, au plus
 *   proche centre à centre), que l'Apple TV traduit nativement ; `sectionEntry`
 *   son exception (l'entrée « première visite ») ;
 * - `reveal.ts`, `revealMotion.ts` : la page qui suit le focus (cible, rafale,
 *   ressort) — la spécification de la vue native d'Apple TV ;
 * - `focusTrack.ts` : le suivi de la clé focalisée ;
 * - `screenEntry.ts`, `homeEntry.ts` : l'entrée d'un écran et le retour ;
 * - `groupEntry.ts` : l'entrée d'un groupe (le dernier visité, sinon le défaut) ;
 * - `restoreClaim.ts`, `keepWithin.ts` : la reprise après une restauration de
 *   la plateforme, la garde d'une surface plein écran ;
 * - `beyondEdge.ts` : un geste au-delà du bord ;
 * - `focusReveal.ts` : ce qui paraît au focus — tout de suite ; le focus qui
 *   tient ne règle plus que ce qui coûte (lecture de la qualité, halo) ;
 * - `rowRewind.ts` : les rangées d'une page du rail qui reviennent au début
 *   (sorties de l'écran, changement de page, Retour vers la première carte) ;
 * - les écrans (T7) : `detailFocus.ts` (la fiche), `gridFocus.ts` (les grilles,
 *   Ma liste, Favoris, Parcourir), `libraryFocus.ts` (la bibliothèque),
 *   `settingsFocus.ts` (les réglages), `pairingFocus.ts` (le jumelage),
 *   `profilesFocus.ts` (« Qui regarde ? », le PIN, « Gérer les profils »). */
export * from "./geometry";
export * from "./sections";
export * from "./sectionEntry";
export * from "./reveal";
export * from "./revealMotion";
export * from "./focusTrack";
export * from "./screenEntry";
export * from "./homeEntry";
export * from "./groupEntry";
export * from "./restoreClaim";
export * from "./keepWithin";
export * from "./beyondEdge";
export * from "./rowRewind";
export * from "./focusReveal";
export * from "./detailFocus";
export * from "./gridFocus";
export * from "./libraryFocus";
export * from "./settingsFocus";
export * from "./pairingFocus";
export * from "./profilesFocus";
