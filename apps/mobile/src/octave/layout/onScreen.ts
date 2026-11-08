/**
 * Octave (mobile) — ce qui SE VOIT, règle pure : une animation qui ne se voit pas ne doit rien coûter (lot « bat »,
 * batterie). Reanimated 3 sur Fabric clone l'arbre, relance Yoga et monte à CHAQUE image, même d'une simple
 * transformation : une boucle sur une page restée dans la pile, sous le lecteur plein écran ou app derrière
 * consommait autant qu'à l'écran.
 */

export interface ScreenPresence {
  /** L'app est au premier plan (ni derrière, ni écran verrouillé, ni interrompue par iOS). */
  appActive: boolean;
  /** La page est celle qu'on regarde (pas une page restée dessous dans la pile). Hors d'une page : vrai. */
  pageFocused: boolean;
  /** Le lecteur plein écran est ouvert (il couvre les pages et le mini-lecteur). */
  playerOpen: boolean;
}

/** Une surface posée SOUS le lecteur plein écran (une page, le mini-lecteur) se voit-elle ? */
export function shownBeneathPlayer({ appActive, pageFocused, playerOpen }: ScreenPresence): boolean {
  return appActive && pageFocused && !playerOpen;
}

/**
 * Les barres du titre en cours : `dance` (en boucle), `rest` (posées, en douceur : la pause se voit),
 * `still` (posées d'un coup, sans animation : personne ne les voit, ou le mouvement est réduit).
 */
export type BarsMotion = "dance" | "rest" | "still";

export function barsMotion({ shown, playing, reducedMotion }: { shown: boolean; playing: boolean; reducedMotion: boolean }): BarsMotion {
  if (!shown || reducedMotion) return "still";
  return playing ? "dance" : "rest";
}
