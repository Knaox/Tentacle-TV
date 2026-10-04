/**
 * La CADENCE du focus sous une flèche MAINTENUE — pour une plateforme qui
 * répète la touche (Android TV : un appui, puis ~470 ms plus tard une
 * répétition toutes les ~50 ms, `KeyEvent.getRepeatCount() > 0`).
 *
 * Laissé à lui-même, le focus ferait un pas à CHAQUE répétition : vingt
 * cartes ou lignes par seconde dès la première, plus vite que l'œil ne suit
 * et que les images n'arrivent. Caler les pas sur les répétitions ne suffit
 * pas non plus : elles tombent toutes les 50 ms, un pas sur trois puis un sur
 * deux puis chacune — la vitesse DOUBLE d'un coup, deux fois.
 *
 * Ce que font Leanback (`BaseGridView` : ses déplacements en attente, joués à
 * son rythme) et les applications du salon : le focus avance sur SA propre
 * horloge, qui ACCÉLÈRE en continu tant que la flèche reste tenue. Ici :
 *
 * - la première répétition OUVRE la tenue et fait un pas tout de suite (l'appui,
 *   lui, a déjà fait le sien : c'est un pas isolé) ;
 * - ensuite, un pas tous les `repeatInterval` — de `startIntervalMs` à
 *   `minIntervalMs`, linéairement sur `rampMs` —, sur l'horloge des images,
 *   sans rattrapage (une image en retard ne fait jamais deux pas) ;
 * - les répétitions ne font plus que dire « toujours tenue » : absorbées ;
 * - relâcher la flèche, ou en presser une autre, arrête tout ; plus aucune
 *   répétition depuis `silentReleaseMs` aussi (le relâchement est parti
 *   ailleurs : le focus a quitté ce qui tenait la flèche).
 *
 * Chaque pas dit aussi l'intervalle jusqu'au suivant : la page qui suit le
 * focus le parcourt à vitesse constante pendant ce temps
 * (`focus/burstFollow.ts`) — elle arrive quand le pas suivant part.
 *
 * Les valeurs rejoignent l'Apple TV, flèche tenue sur une grille : ~12 lignes
 * par seconde mesurées au banc des bibliothèques (63 449 pt en ~10 s).
 *
 * L'Apple TV n'en a pas besoin (sa table ne répète pas) : rien n'y change.
 * Sur Android TV, l'application est NATIVE (`HoldPacer.kt`) : une répétition
 * doit être absorbée AVANT que la plateforme ne déplace le focus. Les
 * constantes y passent depuis ce module (`platform/androidtv/focus/`) ; ses
 * tests sont le cahier des charges des deux.
 *
 * Module pur : temps en millisecondes, horloge passée par l'appelant.
 */

export const REPEAT_PACING = {
  /** L'intervalle au début d'une tenue : ~6 pas par seconde. */
  startIntervalMs: 160,
  /** Le plafond, atteint au bout de `rampMs` : ~14 pas par seconde. */
  minIntervalMs: 70,
  /** La montée de l'un à l'autre, depuis le premier pas de la tenue. */
  rampMs: 1_500,
  /** Plus aucune répétition depuis ce temps (elles viennent toutes les ~50 ms) : relâchée. */
  silentReleaseMs: 300,
} as const;

export type RepeatPacingSpec = { readonly [K in keyof typeof REPEAT_PACING]: number };

export interface HoldPacingState {
  /** La flèche tenue (un code de la plateforme), ou null. */
  key: number | string | null;
  /** Le premier pas de la tenue. */
  holdAt: number;
  /** Le prochain pas, sur l'horloge de la tenue. */
  nextStepAt: number;
  /** La dernière répétition reçue. */
  lastRepeatAt: number;
}

export const HOLD_IDLE: HoldPacingState = { key: null, holdAt: 0, nextStepAt: 0, lastRepeatAt: 0 };

/** L'intervalle voulu, `elapsedMs` après le premier pas de la tenue. */
export function repeatInterval(elapsedMs: number, spec: RepeatPacingSpec = REPEAT_PACING): number {
  const progress = spec.rampMs > 0 ? Math.min(1, Math.max(0, elapsedMs / spec.rampMs)) : 1;
  return spec.startIntervalMs - (spec.startIntervalMs - spec.minIntervalMs) * progress;
}

/**
 * Une répétition de la plateforme : elle ouvre la tenue (`started` : le
 * premier pas est dû tout de suite) ou dit seulement qu'elle continue.
 * Jamais un pas par elle-même : c'est `holdTick` qui les fait.
 */
export function holdRepeat(state: HoldPacingState, input: { key: number | string; now: number }): { started: boolean; state: HoldPacingState } {
  const { key, now } = input;
  if (state.key !== key) return { started: true, state: { key, holdAt: now, nextStepAt: now, lastRepeatAt: now } };
  return { started: false, state: { ...state, lastRepeatAt: now } };
}

export interface HoldTick {
  /** Un pas, maintenant. */
  step: boolean;
  /** Ce pas : l'intervalle jusqu'au suivant (la durée de son mouvement). */
  intervalMs: number;
  /** La tenue est finie (plus aucune répétition) : plus d'images à attendre. */
  released: boolean;
  state: HoldPacingState;
}

/** Une image de la tenue, à `now` : faut-il faire un pas ? */
export function holdTick(state: HoldPacingState, now: number, spec: RepeatPacingSpec = REPEAT_PACING): HoldTick {
  if (state.key === null) return { step: false, intervalMs: 0, released: true, state };
  if (now - state.lastRepeatAt > spec.silentReleaseMs) return { step: false, intervalMs: 0, released: true, state: HOLD_IDLE };
  if (now < state.nextStepAt) return { step: false, intervalMs: 0, released: false, state };
  const intervalMs = repeatInterval(state.nextStepAt - state.holdAt, spec);
  const scheduled = state.nextStepAt + intervalMs;
  // En retard d'un intervalle entier (une image très longue) : on repart d'ici, sans rattraper.
  const nextStepAt = scheduled > now ? scheduled : now + intervalMs;
  return { step: true, intervalMs, released: false, state: { ...state, nextStepAt } };
}

/** La flèche relâchée (la sienne) : la tenue finit. Une autre flèche relâchée n'y touche pas. */
export function holdRelease(state: HoldPacingState, key: number | string): HoldPacingState {
  return state.key === key ? HOLD_IDLE : state;
}
