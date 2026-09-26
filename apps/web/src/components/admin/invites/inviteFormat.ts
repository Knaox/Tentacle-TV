import { inviteStatus, type AdminInviteDto, type InviteStatus } from "@tentacle-tv/shared";

/**
 * Les mises en forme de la page Invitations : temps relatif, échéances, tri
 * et décompte par statut. Pures — la page ne fait que les appeler.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * « dans 3 jours », « demain », « il y a 2 heures » : l'unité la plus parlante,
 * arrondie — 71 h 59 se lit « dans 3 jours », pas « dans 72 heures ». Sous la
 * minute, `null` : c'est à la page de dire « à l'instant ».
 */
export function relativeTime(targetMs: number, nowMs: number, locale: string): string | null {
  const diff = targetMs - nowMs;
  if (Math.abs(diff) < MINUTE) return null;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minutes = Math.round(diff / MINUTE);
  if (Math.abs(minutes) < 60) return format.format(minutes, "minute");
  const hours = Math.round(diff / HOUR);
  if (Math.abs(hours) < 24) return format.format(hours, "hour");
  const days = Math.round(diff / DAY);
  if (Math.abs(days) < 45) return format.format(days, "day");
  const months = Math.round(days / 30.4375);
  if (Math.abs(months) < 12) return format.format(months, "month");
  return format.format(Math.round(days / 365.25), "year");
}

/** « mardi 29 septembre à 21:14 » — l'échéance annoncée avant de créer. */
export function formatDeadline(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit",
  }).format(ms);
}

/** « 29 sept. 2026, 21:14 » — la date exacte, en infobulle d'un temps relatif. */
export function formatDateTime(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(ms);
}

/** Moins d'un jour avant l'échéance : l'échéance se signale. */
export function expiresSoon(invite: Pick<AdminInviteDto, "expiresAt">, now: number): boolean {
  if (invite.expiresAt === null) return false;
  const left = Date.parse(invite.expiresAt) - now;
  return left > 0 && left < DAY;
}

export type InviteFilter = "all" | InviteStatus;

export function countByStatus(invites: readonly AdminInviteDto[], now: number): Record<InviteFilter, number> {
  const counts: Record<InviteFilter, number> = { all: invites.length, active: 0, expired: 0, exhausted: 0 };
  for (const invite of invites) counts[inviteStatus(invite, now)]++;
  return counts;
}

/**
 * Les invitations encore valables d'abord — ce sont celles qu'on vient
 * chercher —, puis les autres ; la plus récente en tête de chaque groupe.
 */
export function sortInvites(invites: readonly AdminInviteDto[], now: number): AdminInviteDto[] {
  const rank = (invite: AdminInviteDto) => (inviteStatus(invite, now) === "active" ? 0 : 1);
  return [...invites].sort(
    (a, b) => rank(a) - rank(b) || Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}
