/**
 * Les choix de « Vous regardez encore ? » dits en mots — une seule table pour
 * les Réglages du web et du bureau (`StillWatchingSetting`) et le panneau du
 * miroir (`PlaybackPane`). Les durées viennent du contrat partagé
 * (`stillWatchingSettings.ts`) ; les valeurs voyagent en chaînes, la forme
 * qu'attendent les contrôles segmentés.
 */

import type { TFunction } from "i18next";
import { STILL_WATCHING_AFTER_CHOICES_MS, STILL_WATCHING_COUNTDOWN_CHOICES_MS } from "@tentacle-tv/shared";

export interface StillWatchingChoice {
  value: string;
  label: string;
}

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

function afterLabel(t: TFunction, ms: number): string {
  if (ms % HOUR_MS === 0) return t("preferences:stillWatchingHours", { count: ms / HOUR_MS });
  if (ms === HOUR_MS * 1.5) return t("preferences:stillWatchingHourHalf");
  return t("preferences:stillWatchingHours", { count: Math.round((ms / HOUR_MS) * 10) / 10 });
}

function countdownLabel(t: TFunction, ms: number): string {
  if (ms === MINUTE_MS) return t("preferences:stillWatchingMinute");
  return t("preferences:stillWatchingSeconds", { count: Math.round(ms / 1000) });
}

/** « Demander après » : 1 h, 1 h 30, 2 h, 3 h. */
export function stillWatchingAfterChoices(t: TFunction): StillWatchingChoice[] {
  return STILL_WATCHING_AFTER_CHOICES_MS.map((ms) => ({ value: String(ms), label: afterLabel(t, ms) }));
}

/** « Temps pour répondre » : 10 s, 30 s, 1 minute. */
export function stillWatchingCountdownChoices(t: TFunction): StillWatchingChoice[] {
  return STILL_WATCHING_COUNTDOWN_CHOICES_MS.map((ms) => ({ value: String(ms), label: countdownLabel(t, ms) }));
}
