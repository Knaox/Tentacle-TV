/**
 * Le calendrier LOCAL de l'utilisateur : jours, mois, jour de semaine et heure
 * d'un instant, dans SON fuseau — jamais celui du serveur.
 *
 * Tout décalage horaire au monde est un multiple de 15 minutes, changements
 * d'heure compris : une frontière d'heure locale ne tombe donc jamais au
 * milieu d'un quart d'heure UTC. On formate une fois par quart d'heure et on
 * le retient, ce qui rend le découpage d'une séance en heures quasi gratuit.
 *
 * Les dates sont manipulées en chaînes « AAAA-MM-JJ » : l'ordre alphabétique
 * est l'ordre chronologique, et l'arithmétique des jours se fait en UTC sur les
 * composantes — sans fuseau, donc sans piège de changement d'heure.
 */

export const SLOT_MS = 15 * 60_000;

export interface LocalParts {
  /** « AAAA-MM-JJ » */
  day: string;
  /** « AAAA-MM » */
  month: string;
  year: number;
  /** 0 = lundi … 6 = dimanche. */
  weekday: number;
  /** 0 … 23 */
  hour: number;
}

const WEEKDAYS: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/**
 * Le fuseau à appliquer : celui du client s'il est connu du moteur ICU, UTC
 * sinon. Un nom inventé ne fait pas planter la page — il la met à l'heure
 * universelle, ce qui reste lisible.
 */
export function resolveTimeZone(input: string | null | undefined): string {
  if (!input) return "UTC";
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: input }).resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export class LocalCalendar {
  private readonly format: Intl.DateTimeFormat;
  private readonly slots = new Map<number, LocalParts>();

  constructor(readonly timeZone: string) {
    this.format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    });
  }

  parts(ms: number): LocalParts {
    const slot = Math.floor(ms / SLOT_MS);
    const known = this.slots.get(slot);
    if (known) return known;
    const found: Record<string, string> = {};
    for (const p of this.format.formatToParts(new Date(slot * SLOT_MS))) found[p.type] = p.value;
    const month = `${found.year}-${found.month}`;
    const parts: LocalParts = {
      day: `${month}-${found.day}`,
      month,
      year: Number(found.year),
      weekday: WEEKDAYS[found.weekday] ?? 0,
      hour: Number(found.hour) % 24,
    };
    this.slots.set(slot, parts);
    return parts;
  }
}

function fromUtcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Le jour qui suit (ou précède, `delta` négatif) une date « AAAA-MM-JJ ». */
export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return fromUtcDate(new Date(Date.UTC(y, m - 1, d + delta)));
}

/** Le mois qui suit (ou précède) un mois « AAAA-MM ». */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return fromUtcDate(new Date(Date.UTC(y, m - 1 + delta, 1))).slice(0, 7);
}

/** Nombre de mois de `from` à `to` inclus (« 2026-01 » → « 2026-03 » = 3). */
export function monthSpan(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}
