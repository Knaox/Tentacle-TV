/**
 * Les choix de « Vous regardez encore ? » dits en mots — une seule table pour
 * les Réglages du web et du bureau (`StillWatchingSetting`) et le panneau du
 * miroir (`StillWatchingRows`, rubrique « Lecture et apparence »). La règle des libellés est partagée avec le mobile
 * et les téléviseurs (`stillWatchingChoices.ts`, shared) ; les valeurs
 * voyagent en chaînes, la forme qu'attendent les contrôles segmentés.
 */

import type { TFunction } from "i18next";
import { STILL_WATCHING_AFTER_CHOICES, STILL_WATCHING_COUNTDOWN_CHOICES, type StillWatchingChoice as Choice } from "@tentacle-tv/shared";

export interface StillWatchingChoice {
  value: string;
  label: string;
}

const optionsOf = (choices: readonly Choice[], t: TFunction): StillWatchingChoice[] =>
  choices.map(({ ms, label }) => ({
    value: String(ms),
    label: label.count === undefined ? t(label.key) : t(label.key, { count: label.count }),
  }));

/** « Demander après » : 1 h, 1 h 30, 2 h, 3 h. */
export function stillWatchingAfterChoices(t: TFunction): StillWatchingChoice[] {
  return optionsOf(STILL_WATCHING_AFTER_CHOICES, t);
}

/** « Temps pour répondre » : 10 s, 30 s, 1 minute. */
export function stillWatchingCountdownChoices(t: TFunction): StillWatchingChoice[] {
  return optionsOf(STILL_WATCHING_COUNTDOWN_CHOICES, t);
}
