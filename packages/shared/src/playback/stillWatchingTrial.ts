import type { StillWatchingSettings } from "./stillWatchingSettings";

/**
 * « Essayer » — voir « Vous regardez encore ? » sans attendre des heures de
 * lecture. Un geste des Réglages arme UN essai : à la prochaine lecture, la
 * question paraît au bout de `STILL_WATCHING_TRIAL_AFTER_MS` de lecture sans
 * geste au lieu de l'heure et demie réglée. Tout le reste est le VRAI
 * comportement : le même encart, le même décompte (celui du réglage), la même
 * pause à l'expiration.
 *
 * - L'essai ne vit que dans la mémoire de l'application (jamais stocké, jamais
 *   envoyé au compte) : un redémarrage l'oublie.
 * - Il se consomme quand la question est POSÉE : « Continuer » ou la pause,
 *   et le minuteur revient au réglage du compte.
 * - Oublié, il s'éteint seul après `STILL_WATCHING_TRIAL_TTL_MS` : une
 *   question à vingt secondes ne doit pas surprendre une soirée plus tard.
 * - Il ne rallume rien : réglage coupé, pas de question, essai ou non.
 *
 * Module pur, horloge injectée : `stillWatchingTrial.test.ts`.
 */

/** Le temps de lecture sans geste avant la question, pendant l'essai. */
export const STILL_WATCHING_TRIAL_AFTER_MS = 20_000;
/** Au-delà, un essai jamais joué s'éteint. */
export const STILL_WATCHING_TRIAL_TTL_MS = 10 * 60_000;

export interface StillWatchingTrial {
  armedAt: number;
}

export function armStillWatchingTrial(now: number): StillWatchingTrial {
  return { armedAt: now };
}

/** L'essai attend-il encore sa lecture ? */
export function stillWatchingTrialLive(trial: StillWatchingTrial | null, now: number): boolean {
  return trial !== null && now >= trial.armedAt && now - trial.armedAt < STILL_WATCHING_TRIAL_TTL_MS;
}

/** Le temps qui reste avant que l'essai s'éteigne de lui-même ; 0 s'il n'y en a pas. */
export function stillWatchingTrialRemainingMs(trial: StillWatchingTrial | null, now: number): number {
  if (!stillWatchingTrialLive(trial, now) || trial === null) return 0;
  return STILL_WATCHING_TRIAL_TTL_MS - (now - trial.armedAt);
}

/**
 * Le réglage que le minuteur applique : celui du compte, la question avancée
 * pendant l'essai. Rend le MÊME objet hors essai (comparaison par identité).
 */
export function withStillWatchingTrial(
  settings: StillWatchingSettings,
  trial: StillWatchingTrial | null,
  now: number,
): StillWatchingSettings {
  if (!settings.enabled || !stillWatchingTrialLive(trial, now)) return settings;
  return { ...settings, afterMs: Math.min(settings.afterMs, STILL_WATCHING_TRIAL_AFTER_MS) };
}
