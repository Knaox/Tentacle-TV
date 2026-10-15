/**
 * Les choix de « Vous regardez encore ? » dits en mots — UNE règle pour les
 * Réglages du web et du bureau, le panneau du miroir, le mobile et les
 * téléviseurs. Les durées viennent de la liste FERMÉE du contrat
 * (`stillWatchingSettings.ts`) ; chaque client traduit la clé rendue
 * (`preferences:`), avec son compte.
 *
 * Une valeur réglée hors de la liste (bornée par le serveur) n'a pas de
 * libellé à elle : aucun choix n'est coché, le réglage reste.
 */

import { STILL_WATCHING_AFTER_CHOICES_MS, STILL_WATCHING_COUNTDOWN_CHOICES_MS } from "./stillWatchingSettings";

/** Un libellé à traduire : sa clé `preferences:`, et le nombre qu'elle accorde. */
export interface StillWatchingChoiceLabel {
  key: string;
  count?: number;
}

/** Un choix offert : sa durée en millisecondes, et ce qu'il dit. */
export interface StillWatchingChoice {
  ms: number;
  label: StillWatchingChoiceLabel;
}

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/** « 1 heure », « 1 h 30 », « 2 heures »… — le temps avant la question. */
export function stillWatchingAfterLabel(ms: number): StillWatchingChoiceLabel {
  if (ms % HOUR_MS === 0) return { key: "preferences:stillWatchingHours", count: ms / HOUR_MS };
  if (ms === HOUR_MS * 1.5) return { key: "preferences:stillWatchingHourHalf" };
  return { key: "preferences:stillWatchingHours", count: Math.round((ms / HOUR_MS) * 10) / 10 };
}

/** « 10 secondes », « 30 secondes », « 1 minute » — le temps pour répondre. */
export function stillWatchingCountdownLabel(ms: number): StillWatchingChoiceLabel {
  if (ms === MINUTE_MS) return { key: "preferences:stillWatchingMinute" };
  return { key: "preferences:stillWatchingSeconds", count: Math.round(ms / 1000) };
}

/** « Demander après » : 1 h, 1 h 30, 2 h, 3 h. */
export const STILL_WATCHING_AFTER_CHOICES: readonly StillWatchingChoice[] = STILL_WATCHING_AFTER_CHOICES_MS.map(
  (ms) => ({ ms, label: stillWatchingAfterLabel(ms) }),
);

/** « Temps pour répondre » : 10 s, 30 s, 1 minute. */
export const STILL_WATCHING_COUNTDOWN_CHOICES: readonly StillWatchingChoice[] = STILL_WATCHING_COUNTDOWN_CHOICES_MS.map(
  (ms) => ({ ms, label: stillWatchingCountdownLabel(ms) }),
);
