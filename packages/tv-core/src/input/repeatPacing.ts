/**
 * La CADENCE du focus sous une flèche MAINTENUE — pour une plateforme qui
 * répète la touche (Android TV : un appui, puis ~470 ms plus tard une
 * répétition toutes les ~50 ms, `KeyEvent.getRepeatCount() > 0`).
 *
 * Laissé à lui-même, le focus ferait un pas à CHAQUE répétition : vingt
 * cartes ou lignes par seconde dès la première, plus vite que l'œil ne suit
 * et plus vite que les images n'arrivent — la page saute de case en case.
 * Ce que font Leanback (`BaseGridView`, ses déplacements en attente) et les
 * applications du salon (Netflix, YouTube) : le focus avance à un rythme
 * propre, qui ACCÉLÈRE tant que la flèche reste tenue, jusqu'à un plafond.
 * L'Apple TV fait de même à sa façon (son défilement rapide après une à deux
 * secondes de rafale) ; ce module en donne l'équivalent à une télécommande
 * qui n'a que des répétitions.
 *
 * - le PREMIER appui passe toujours (ce n'est pas une répétition) ;
 * - une répétition passe si l'intervalle de la rafale est écoulé depuis le
 *   pas précédent, au jeu de la plateforme près (`jitterMs` : ses répétitions
 *   ne tombent pas pile) ; sinon elle est ABSORBÉE — le focus ne bouge pas,
 *   la touche est consommée ;
 * - l'intervalle va de `startIntervalMs` à `minIntervalMs`, linéairement,
 *   sur `rampMs` depuis le premier pas de la rafale (sa première répétition
 *   acceptée) ;
 * - relâcher la flèche, ou en presser une autre, finit la rafale.
 *
 * Le pas d'une rafale rend aussi l'intervalle RÉEL depuis le pas précédent :
 * la page qui suit le focus le parcourt à vitesse constante pendant ce temps
 * (`focus/burstFollow.ts`) — elle arrive quand le pas suivant part.
 *
 * L'Apple TV n'en a pas besoin (`RemoteTraits` : sa table ne répète pas) :
 * rien n'y change. Sur Android TV, la traduction est NATIVE
 * (`apps/tv/android/.../focus/RepeatPacer.kt`) : la touche doit être
 * absorbée AVANT que la plateforme ne déplace le focus. Les constantes y
 * passent depuis ce module (`platform/androidtv/focus/`) ; ses tests sont le
 * cahier des charges des deux.
 *
 * Module pur : temps en millisecondes, horloge passée par l'appelant.
 */

export const REPEAT_PACING = {
  /** L'intervalle au début d'une rafale : ~6 pas par seconde. */
  startIntervalMs: 160,
  /** Le plafond, atteint au bout de `rampMs` : ~16 à 20 pas par seconde. */
  minIntervalMs: 60,
  /** La montée de l'un à l'autre, depuis le premier pas de la rafale. */
  rampMs: 1_500,
  /** Le jeu des répétitions de la plateforme (elles ne tombent pas pile). */
  jitterMs: 12,
} as const;

export type RepeatPacingSpec = { readonly [K in keyof typeof REPEAT_PACING]: number };

export interface RepeatPacingState {
  /** La touche de la rafale en cours (un code de la plateforme), ou null. */
  key: number | string | null;
  /** Le premier pas de la rafale (sa première répétition acceptée) ; 0 : aucun encore. */
  burstAt: number;
  /** Le dernier pas accepté (l'appui compris). */
  lastStepAt: number;
}

export const REPEAT_IDLE: RepeatPacingState = { key: null, burstAt: 0, lastStepAt: 0 };

export interface RepeatDecision {
  /** Le focus fait-il ce pas ? */
  accept: boolean;
  /** Le pas appartient-il à une rafale (une répétition acceptée) ? */
  burst: boolean;
  /** L'intervalle réel depuis le pas précédent (0 pour un appui). */
  intervalMs: number;
  state: RepeatPacingState;
}

/** L'intervalle voulu, `elapsedMs` après le premier pas de la rafale. */
export function repeatInterval(elapsedMs: number, spec: RepeatPacingSpec = REPEAT_PACING): number {
  const progress = spec.rampMs > 0 ? Math.min(1, Math.max(0, elapsedMs / spec.rampMs)) : 1;
  return spec.startIntervalMs - (spec.startIntervalMs - spec.minIntervalMs) * progress;
}

/**
 * Une flèche enfoncée : son premier appui (`repeat: false`) ou une répétition.
 * Rend s'il faut déplacer le focus, et l'état suivant.
 */
export function paceArrow(
  state: RepeatPacingState,
  input: { key: number | string; repeat: boolean; now: number },
  spec: RepeatPacingSpec = REPEAT_PACING,
): RepeatDecision {
  const { key, repeat, now } = input;
  if (!repeat || state.key !== key) {
    // Un appui neuf (ou une autre flèche) : toujours un pas, une rafale neuve.
    return { accept: true, burst: false, intervalMs: 0, state: { key, burstAt: 0, lastStepAt: now } };
  }
  const elapsed = now - state.lastStepAt;
  const wanted = repeatInterval(state.burstAt > 0 ? now - state.burstAt : 0, spec);
  if (elapsed < wanted - spec.jitterMs) {
    return { accept: false, burst: true, intervalMs: 0, state };
  }
  return {
    accept: true,
    burst: true,
    intervalMs: elapsed,
    state: { key, burstAt: state.burstAt > 0 ? state.burstAt : now, lastStepAt: now },
  };
}

/** La flèche relâchée : la rafale finit. */
export function releaseArrow(state: RepeatPacingState, key: number | string): RepeatPacingState {
  return state.key === key ? REPEAT_IDLE : state;
}
