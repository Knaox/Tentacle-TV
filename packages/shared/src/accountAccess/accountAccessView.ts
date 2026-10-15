import type { AccessScheduleDay, AccessScheduleDto } from "../userRights/userRightsContract";
import type { AccountAccessBlocked } from "./accountAccessContract";
import { systemZone, type ZoneOffset } from "./accountAccessRule";

/**
 * Ce que la PAGE d'un compte bloqué dit (docs/DROITS-UTILISATEURS.md § 9.1) —
 * web, bureau, Apple TV : la même lecture, les mots dans l'espace i18n
 * `accountAccess`. Module pur, client seulement (pas de miroir).
 */

/** L'ordre des plages à l'écran : les groupes de jours, puis lundi → dimanche. */
export const ACCESS_DAY_ORDER: readonly AccessScheduleDay[] = [
  "Everyday", "Weekday", "Weekend", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

/** Une plage à afficher : son jour (`accountAccess:days.<jour>`), début et fin en minutes (1440 = minuit). */
export interface ScheduleLine {
  day: AccessScheduleDay;
  start: number;
  end: number;
}

/** Les plages lisibles, dans l'ordre ; la sentinelle « jamais » (début à 24 h) n'en est pas une. */
export function scheduleLines(schedules: readonly AccessScheduleDto[]): ScheduleLine[] {
  return schedules
    .filter((entry) => entry.startHour < 24 && entry.startHour <= entry.endHour)
    .map((entry) => ({ day: entry.dayOfWeek, start: Math.round(entry.startHour * 60), end: Math.round(Math.min(24, entry.endHour) * 60) }))
    .sort((a, b) => ACCESS_DAY_ORDER.indexOf(a.day) - ACCESS_DAY_ORDER.indexOf(b.day) || a.start - b.start);
}

/** Quand Tentacle rouvre, dit à l'utilisateur : le jour relatif (fuseau de l'APPAREIL) et l'instant. */
export type Reopening =
  | { kind: "today" | "tomorrow" | "later"; at: number }
  /** Aucune plage ne s'ouvre (la sentinelle « jamais », ou rien dans les huit jours). */
  | { kind: "never" }
  /** Les plages ne sont pas connues (jeton dont le serveur a oublié le compte). */
  | { kind: "unknown" };

const DAY = 86_400_000;
const localDay = (ms: number, zone: ZoneOffset) => Math.floor((ms + zone(ms) * 60_000) / DAY);

export function reopeningOf(blocked: AccountAccessBlocked, now: number, zone: ZoneOffset = systemZone): Reopening | null {
  if (blocked.state !== "outsideSchedule") return null;
  if (blocked.schedules.length === 0) return { kind: "unknown" };
  if (blocked.nextOpening === null) return { kind: "never" };
  const days = localDay(blocked.nextOpening, zone) - localDay(now, zone);
  return { kind: days <= 0 ? "today" : days === 1 ? "tomorrow" : "later", at: blocked.nextOpening };
}

export type AccountAccessVariant = "disabled" | "lockedOut" | "outsideSchedule";

export interface AccountAccessView {
  variant: AccountAccessVariant;
  /** `accountAccess:<variant>.title` et `.body`. */
  titleKey: string;
  bodyKey: string;
  lines: ScheduleLine[];
  reopening: Reopening | null;
}

export function accountAccessView(blocked: AccountAccessBlocked, now: number, zone: ZoneOffset = systemZone): AccountAccessView {
  const variant: AccountAccessVariant =
    blocked.state === "outsideSchedule" ? "outsideSchedule" : blocked.lockedOut ? "lockedOut" : "disabled";
  return {
    variant,
    titleKey: `${variant}.title`,
    bodyKey: `${variant}.body`,
    lines: blocked.state === "outsideSchedule" ? scheduleLines(blocked.schedules) : [],
    reopening: reopeningOf(blocked, now, zone),
  };
}
