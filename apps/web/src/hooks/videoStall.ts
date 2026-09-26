/**
 * Le décodeur vidéo s'est-il arrêté pendant que la lecture continue ?
 *
 * Le cas mesuré le 16 septembre 2026 : `currentTime` avance, le son joue,
 * `readyState` reste à 4, aucun `waiting`, aucune erreur — et
 * `totalVideoFrames` ne bouge plus. L'image est figée sans qu'aucun événement
 * ne le dise. Une recherche, même minime, remet le décodeur en route (mesuré :
 * un saut dans le tampon rend les images).
 *
 * Pure : l'appelant relève les compteurs, ce module ne juge que l'écart entre
 * deux relevés.
 */

export interface StallSample {
  /** Secondes de lecture écoulées entre les deux relevés. */
  playedS: number;
  /** Images décodées entre les deux relevés. */
  decodedFrames: number;
  paused: boolean;
  seeking: boolean;
  /** `HTMLMediaElement.readyState` — 3 = HAVE_FUTURE_DATA. */
  readyState: number;
  /** L'onglet est visible : masqué, le navigateur cesse de décoder de lui-même. */
  visible: boolean;
  /** Le média a une piste vidéo (largeur connue). */
  hasVideo: boolean;
  /** Le compteur `totalVideoFrames` a déjà avancé sur cet élément. Sur webOS,
   *  la vidéo passe par un plan matériel que le navigateur ne compte pas : le
   *  compteur reste à 0 toute la lecture (mesuré le 26 septembre 2026, 4K sur
   *  la C3). Un compteur muet ne prouve aucun gel — on ne juge pas. */
  framesCounted: boolean;
}

/** Au-dessous, on ne conclut pas : quelques images en retard ne sont pas un gel. */
export const STALL_MIN_PLAYED_S = 1.5;

export function videoStalled(s: StallSample): boolean {
  if (s.paused || s.seeking || !s.visible || !s.hasVideo || !s.framesCounted || s.readyState < 3) return false;
  return s.playedS >= STALL_MIN_PLAYED_S && s.decodedFrames === 0;
}
