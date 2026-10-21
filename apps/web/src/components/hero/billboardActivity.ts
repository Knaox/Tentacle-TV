/**
 * Ce que la bannière d'accueil fait tourner, selon où elle est.
 *
 * Deux seuils, et c'est le cœur de la règle :
 *  - PRÈS de l'écran (marge de 200 px) : le halo flouté est MONTÉ d'avance,
 *    pour qu'on ne surprenne jamais son fondu d'apparition en remontant ;
 *  - STRICTEMENT à l'écran : la rotation tourne — et avec elle le zoom de
 *    chaque nouvelle diapositive, son fondu, la barre de progression.
 *
 * La rotation suivait jusqu'ici la marge de 200 px : bannière sortie par le
 * haut, elle relançait zoom et progression toutes les huit secondes jusqu'à
 * l'inactivité (20 s) — 51 images composées par seconde pour rien (mesuré,
 * trace Chromium, bureau macOS). Vaut sur toutes les plateformes, avec ou
 * sans verre (CLAUDE.md, « Coût GPU »).
 *
 * Le mode économie et l'inactivité suspendent aussi la rotation (cf.
 * `HeroBillboard`) ; ce qui est en cours va au bout, rien ne repart.
 */
export interface BillboardPlacement {
  /** Dans la marge de 200 px autour de l'écran (fenêtre au premier plan). */
  near: boolean;
  /** Réellement à l'écran (fenêtre au premier plan). */
  onScreen: boolean;
  /** Personne devant l'écran depuis vingt secondes. */
  idle: boolean;
  /** Mode économie de données. */
  dataSaver: boolean;
}

export interface BillboardActivity {
  /** Le halo flouté est-il monté ? */
  haloMounted: boolean;
  /** La rotation (zoom, fondu, progression des nouvelles diapositives) tourne-t-elle ? */
  rotating: boolean;
}

export function billboardActivity({ near, onScreen, idle, dataSaver }: BillboardPlacement): BillboardActivity {
  return { haloMounted: near, rotating: onScreen && !idle && !dataSaver };
}
