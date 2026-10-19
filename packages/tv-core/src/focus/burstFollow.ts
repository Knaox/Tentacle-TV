/**
 * La page — ou la rangée — qui suit le focus sous une flèche MAINTENUE, sur
 * une plateforme qui défile elle-même (Android TV) : le pendant de la rafale
 * de `revealMotion.ts`, où c'est l'animateur de tvOS qui joue.
 *
 * Le focus fait un pas au rythme de `input/repeatPacing.ts`. Un ressort par
 * pas (le pas isolé) traînerait d'une à deux lignes derrière lui : le focus
 * sortirait de l'écran. Un saut par pas (le défaut d'Android) saccade. Ici,
 * chaque pas de rafale part de là où la page EST et va à la cible du pas, à
 * vitesse CONSTANTE, en l'intervalle qui le sépare du pas SUIVANT (la cadence
 * le dit d'avance), plus une image : la page arrive à peine après le départ
 * du pas suivant, elle ne s'arrête jamais entre deux — un mouvement continu,
 * sans à-coup, et le focus toujours montré.
 *
 * Quand la rafale finit (flèche relâchée), la page finit son segment sur le
 * ressort du pas isolé, en gardant sa vitesse — bornée pour ne jamais
 * dépasser la cible (`settleVelocity`).
 *
 * La rangée (défilement HORIZONTAL d'une rangée de cartes) suit la même
 * règle ; sa cible est `rowRevealOffset` : le moins de défilement possible
 * pour montrer la carte entière, aussi loin des bords que les bouts de la
 * rangée le sont des bords de son contenu — la première carte la ramène au
 * début, la dernière à la fin.
 *
 * Sur Android TV l'application est native (`RevealFollower.kt`) ; ce module
 * en est la spécification. Sur Apple TV, `rowRevealOffset` seul, appliqué à
 * la cible que tvOS propose pour la rangée (`TentacleRowScroller.m`, `base` =
 * sa proposition) : tvOS posait la carte à SA marge (~80 pt), sous le rail en
 * revenant vers la gauche. Qui la joue sur Apple TV : un pas ISOLÉ, le ressort
 * de la page ; un pas qui suit le précédent de moins de `ROW_RAPID_STEP_MS`
 * (`rowStepIsRapid`), comme une flèche maintenue, l'animateur de tvOS. Module
 * pur : temps en millisecondes.
 */

/**
 * Deux pas d'une rangée plus rapprochés que ça (GAUCHE / DROITE répétés à la
 * main, ~3,7 pas/s) forment une RAFALE : tvOS les joue, comme une flèche
 * maintenue — le ressort, repris à chaque pas, perdait une image par pas et
 * reculait de quelques points (mesuré au banc de fluidité, 18/10).
 */
export const ROW_RAPID_STEP_MS = 350;

/** Un pas de rangée arrivé `sincePreviousMs` après le précédent (`null` : le premier) : une rafale ? */
export function rowStepIsRapid(sincePreviousMs: number | null): boolean {
  return sincePreviousMs !== null && sincePreviousMs < ROW_RAPID_STEP_MS;
}

export const BURST_FOLLOW = {
  /** Le recouvrement : une image de plus que l'intervalle — les pas tombent sur
   *  l'horloge des images, un segment fini un rien trop tôt arrêterait la page. */
  overlapMs: 17,
  /** Un segment n'est jamais plus court… */
  minSegmentMs: 40,
  /** … ni plus long. */
  maxSegmentMs: 250,
} as const;

/** La durée du segment d'un pas de rafale, depuis l'intervalle jusqu'au pas suivant. */
export function burstSegmentMs(intervalMs: number): number {
  return Math.min(BURST_FOLLOW.maxSegmentMs, Math.max(BURST_FOLLOW.minSegmentMs, intervalMs + BURST_FOLLOW.overlapMs));
}

/** Où en est un segment linéaire `elapsedMs` après son départ, et sa vitesse (unités par seconde). */
export function linearAt(elapsedMs: number, from: number, to: number, durationMs: number): { x: number; v: number; done: boolean } {
  if (durationMs <= 0 || elapsedMs >= durationMs) return { x: to, v: 0, done: true };
  const t = Math.max(0, elapsedMs) / durationMs;
  return { x: from + (to - from) * t, v: ((to - from) * 1000) / durationMs, done: false };
}

/**
 * La vitesse avec laquelle le ressort reprend un segment en vol (la rafale
 * finie) : celle du segment, bornée pour que le ressort critique, de
 * réponse `response` (s), ne dépasse jamais la cible — un ressort critique
 * parti de l'écart `x0` dépasse dès que sa vitesse vers la cible excède
 * `ω·|x0|`. Une vitesse qui s'éloigne de la cible est annulée.
 */
export function settleVelocity(x0: number, v0: number, response: number): number {
  const omega = (2 * Math.PI) / Math.max(0.05, response);
  const towards = -Math.sign(x0); // la cible est en 0 : on va vers −x0
  if (x0 === 0 || Math.sign(v0) !== towards) return 0;
  return towards * Math.min(Math.abs(v0), omega * Math.abs(x0));
}

/** Une rangée qui défile horizontalement, dans le repère de son contenu. */
export interface RowTrack {
  /** La largeur visible. */
  viewport: number;
  /** La largeur du contenu. */
  content: number;
  /** De combien la première carte est loin du début du contenu (le retrait de la rangée). */
  leading: number;
  /** De combien la dernière est loin de sa fin (la marge sûre). */
  trailing: number;
}

/** La position bornée à ce que la rangée peut montrer. */
export function clampRowOffset(x: number, track: RowTrack): number {
  return Math.min(Math.max(x, 0), Math.max(0, track.content - track.viewport));
}

/**
 * Où la rangée doit être pour montrer la carte (`left`, `width`, dans son
 * contenu), depuis `base` — là où elle va déjà. Ni plus près du bord gauche
 * que `leading`, ni du bord droit que `trailing` ; rien si elle l'est déjà.
 * `alwaysStart` (la carte qui s'ouvre, `cards/openCard.ts`) : la carte se pose
 * TOUJOURS au retrait — appliqué tel quel par `TentacleRowScroller.m` et
 * `RevealScroller.kt` (`rowRevealStart`).
 */
export function rowRevealOffset(item: { left: number; width: number }, track: RowTrack, base: number, alwaysStart = false): number {
  const start = item.left - track.leading;
  const end = item.left + item.width + track.trailing - track.viewport;
  const target = alwaysStart ? start : end > base ? Math.min(end, start) : start < base ? start : base;
  return clampRowOffset(target, track);
}
