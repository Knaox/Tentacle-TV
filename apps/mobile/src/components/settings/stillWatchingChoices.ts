import {
  STILL_WATCHING_AFTER_CHOICES_MS,
  STILL_WATCHING_COUNTDOWN_CHOICES_MS,
} from "@tentacle-tv/shared";
import type { ChoiceOption } from "./SegmentedChoice";

type Translate = (key: string, options?: { count: number }) => string;

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/** « 1 heure », « 1 h 30 », « 2 heures »… — les durées avant la question, en mots. */
export function afterChoiceLabel(ms: number, t: Translate): string {
  if (ms % HOUR_MS === 0) return t("stillWatchingHours", { count: ms / HOUR_MS });
  return t("stillWatchingHourHalf");
}

/** « 10 secondes », « 30 secondes », « 1 minute ». */
export function countdownChoiceLabel(ms: number, t: Translate): string {
  if (ms === MINUTE_MS) return t("stillWatchingMinute");
  return t("stillWatchingSeconds", { count: Math.round(ms / 1000) });
}

/**
 * Les pastilles des deux choix — la liste vient de shared, jamais d'un
 * tableau écrit ici. Une valeur réglée ailleurs (hors de la liste, bornée par
 * le serveur) n'a pas de pastille : aucune n'est cochée, le réglage reste.
 */
export function stillWatchingChoices(t: Translate): { after: ChoiceOption[]; countdown: ChoiceOption[] } {
  return {
    after: STILL_WATCHING_AFTER_CHOICES_MS.map((ms) => ({ value: String(ms), label: afterChoiceLabel(ms, t) })),
    countdown: STILL_WATCHING_COUNTDOWN_CHOICES_MS.map((ms) => ({ value: String(ms), label: countdownChoiceLabel(ms, t) })),
  };
}
