import type { AccessScheduleDay, AccessScheduleDto } from "../userRights/userRightsContract";
import type { AccountAccessState } from "./accountAccessContract";

/**
 * La règle de l'ACCÈS d'un compte (docs/DROITS-UTILISATEURS.md § 9.1) — PURE :
 * l'horloge (`now`) et le fuseau (`zone`) sont injectés. Recopiée octet pour
 * octet dans le backend (test miroir).
 *
 * Les plages horaires sont celles de Jellyfin 10.11.11
 * (`UserEntityExtensions.IsParentalScheduleAllowed`) : aucune plage = permis ;
 * sinon l'heure LOCALE h — `TimeOfDay.TotalHours`, secondes comprises — d'un
 * jour couvert (`Everyday`, `Weekday` lundi → vendredi, `Weekend` samedi et
 * dimanche, ou le jour nommé) vérifie `StartHour ≤ h ≤ EndHour`, bornes
 * INCLUSES. h < 24 toujours : la plage sentinelle `{ Sunday, 24, 24 }`
 * (`GUEST_SCHEDULE_NEVER`) ne s'ouvre jamais.
 */

/** Le fuseau : les minutes à AJOUTER à l'heure UTC pour avoir l'heure locale, à cet instant. */
export type ZoneOffset = (epochMs: number) => number;

/** Le fuseau de la machine qui exécute (le serveur Tentacle). */
export const systemZone: ZoneOffset = (epochMs) => -new Date(epochMs).getTimezoneOffset();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Les jours suivants examinés pour trouver un bord de plage : une semaine et un peu. */
const HORIZON_DAYS = 8;

/** Le jour de la semaine (0 = dimanche) couvert par une plage ? */
export function scheduleCoversWeekday(day: AccessScheduleDay, weekday: number): boolean {
  switch (day) {
    case "Everyday":
      return true;
    case "Weekday":
      return weekday >= 1 && weekday <= 5;
    case "Weekend":
      return weekday === 0 || weekday === 6;
    default:
      return WEEKDAY_NAMES[weekday] === day;
  }
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

interface LocalDay {
  /** Minuit local de ce jour, en « millisecondes locales » (UTC décalé). */
  start: number;
  weekday: number;
}

function localDayOf(localMs: number): LocalDay {
  const index = Math.floor(localMs / DAY);
  // Le 1er janvier 1970 était un jeudi (4).
  return { start: index * DAY, weekday: (((index + 4) % 7) + 7) % 7 };
}

/** Une heure locale (ms décalées) ramenée à l'instant réel ; deux passes pour les changements d'heure. */
function toEpoch(localMs: number, zone: ZoneOffset): number {
  const first = localMs - zone(localMs) * MINUTE;
  return localMs - zone(first) * MINUTE;
}

/** L'instant `now` est-il dans une des plages ? Aucune plage : oui. */
export function isWithinSchedules(schedules: readonly AccessScheduleDto[], now: number, zone: ZoneOffset = systemZone): boolean {
  if (schedules.length === 0) return true;
  const local = now + zone(now) * MINUTE;
  const day = localDayOf(local);
  const hour = (local - day.start) / HOUR;
  return schedules.some(
    (entry) => scheduleCoversWeekday(entry.dayOfWeek, day.weekday) && hour >= entry.startHour && hour <= entry.endHour,
  );
}

/** Les instants où une plage commence ou s'achève, autour de `now` (non triés). */
function scheduleEdges(schedules: readonly AccessScheduleDto[], now: number, zone: ZoneOffset): number[] {
  const today = localDayOf(now + zone(now) * MINUTE);
  const edges: number[] = [];
  for (let offset = -1; offset <= HORIZON_DAYS; offset++) {
    const day = localDayOf(today.start + offset * DAY);
    for (const entry of schedules) {
      if (!scheduleCoversWeekday(entry.dayOfWeek, day.weekday)) continue;
      if (entry.startHour < 24) edges.push(toEpoch(day.start + entry.startHour * HOUR, zone));
      // Borne de fin INCLUSE : fermé juste après ; une fin à 24 h ferme à minuit.
      const end = entry.endHour >= 24 ? day.start + DAY : day.start + entry.endHour * HOUR + 1;
      edges.push(toEpoch(end, zone));
    }
  }
  return edges;
}

/**
 * Le prochain instant où l'accès BASCULE (ouverture ou fermeture) — null s'il
 * ne bascule pas dans les huit jours (aucune plage, plages jamais ouvertes, ou
 * ouvertes en continu). Le serveur y pose son minuteur.
 */
export function nextScheduleChange(schedules: readonly AccessScheduleDto[], now: number, zone: ZoneOffset = systemZone): number | null {
  if (schedules.length === 0) return null;
  const current = isWithinSchedules(schedules, now, zone);
  const edges = scheduleEdges(schedules, now, zone)
    .filter((edge) => edge > now)
    .sort((a, b) => a - b);
  for (const edge of edges) if (isWithinSchedules(schedules, edge, zone) !== current) return edge;
  return null;
}

/** La prochaine OUVERTURE d'un compte hors plage — null s'il est dans une plage ou ne rouvre jamais. */
export function nextScheduleOpening(schedules: readonly AccessScheduleDto[], now: number, zone: ZoneOffset = systemZone): number | null {
  if (isWithinSchedules(schedules, now, zone)) return null;
  return nextScheduleChange(schedules, now, zone);
}

/** Ce que la politique Jellyfin d'un compte dit de son accès. */
export interface AccountAccessPolicy {
  /** Faux : Jellyfin n'a pas répondu — rien à juger, le compte n'est pas bloqué pour autant. */
  readable: boolean;
  isDisabled: boolean;
  accessSchedules: readonly AccessScheduleDto[];
  /** `InvalidLoginAttemptCount` de Jellyfin (absent : inconnu). */
  invalidLoginAttemptCount?: number;
  /** `LoginAttemptsBeforeLockout` : -1 (ou absent) = jamais. */
  loginAttemptsBeforeLockout?: number;
}

/** Le compte a-t-il atteint son nombre d'essais avant blocage ? */
export function reachedLoginAttempts(policy: Pick<AccountAccessPolicy, "invalidLoginAttemptCount" | "loginAttemptsBeforeLockout">): boolean {
  const max = policy.loginAttemptsBeforeLockout ?? -1;
  return max > 0 && (policy.invalidLoginAttemptCount ?? 0) >= max;
}

/**
 * L'état d'accès d'un compte À L'INSTANT `now`. Politique illisible : permis
 * (une panne de Jellyfin ne met personne dehors). Désactivé l'emporte sur les plages.
 */
export function accountAccessOf(policy: AccountAccessPolicy, now: number, zone: ZoneOffset = systemZone): AccountAccessState {
  if (!policy.readable) return { state: "allowed" };
  if (policy.isDisabled) return reachedLoginAttempts(policy) ? { state: "disabled", lockedOut: true } : { state: "disabled" };
  if (isWithinSchedules(policy.accessSchedules, now, zone)) return { state: "allowed" };
  return {
    state: "outsideSchedule",
    schedules: policy.accessSchedules.map(({ dayOfWeek, startHour, endHour }) => ({ dayOfWeek, startHour, endHour })),
    nextOpening: nextScheduleOpening(policy.accessSchedules, now, zone),
  };
}

/** Deux états identiques ? (une annonce ne part qu'au CHANGEMENT) */
export function sameAccountAccess(a: AccountAccessState, b: AccountAccessState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
