import {
  STILL_WATCHING_AFTER_CHOICES,
  STILL_WATCHING_COUNTDOWN_CHOICES,
  stillWatchingAfterLabel,
  stillWatchingCountdownLabel,
  type StillWatchingChoice,
  type StillWatchingChoiceLabel,
} from "@tentacle-tv/shared";
import type { ChoiceOption } from "./SegmentedChoice";

type Translate = (key: string, options?: { count: number }) => string;

// La règle des libellés est partagée avec le web et les téléviseurs (shared).
const say = ({ key, count }: StillWatchingChoiceLabel, t: Translate): string =>
  count === undefined ? t(key) : t(key, { count });

/** « 1 heure », « 1 h 30 », « 2 heures »… — les durées avant la question, en mots. */
export function afterChoiceLabel(ms: number, t: Translate): string {
  return say(stillWatchingAfterLabel(ms), t);
}

/** « 10 secondes », « 30 secondes », « 1 minute ». */
export function countdownChoiceLabel(ms: number, t: Translate): string {
  return say(stillWatchingCountdownLabel(ms), t);
}

const optionsOf = (choices: readonly StillWatchingChoice[], t: Translate): ChoiceOption[] =>
  choices.map(({ ms, label }) => ({ value: String(ms), label: say(label, t) }));

/**
 * Les pastilles des deux choix — la liste vient de shared, jamais d'un
 * tableau écrit ici. Une valeur réglée ailleurs (hors de la liste, bornée par
 * le serveur) n'a pas de pastille : aucune n'est cochée, le réglage reste.
 */
export function stillWatchingChoices(t: Translate): { after: ChoiceOption[]; countdown: ChoiceOption[] } {
  return { after: optionsOf(STILL_WATCHING_AFTER_CHOICES, t), countdown: optionsOf(STILL_WATCHING_COUNTDOWN_CHOICES, t) };
}
