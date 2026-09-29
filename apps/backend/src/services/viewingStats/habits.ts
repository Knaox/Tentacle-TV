/**
 * Les habitudes d'un spectateur, à gros grain — ce que la grille jour × heure
 * peut dire à un INCONNU : la part du temps mesuré de chaque grand moment de
 * la journée et le poids du week-end, jamais une heure ni un jour précis.
 * C'est ce qu'emporte la page publique des statistiques partagées, à la place
 * de la grille elle-même.
 *
 * Les bornes sont celles du profil de spectateur (`insights.ts` lit ses parts
 * ici) : « Oiseau de nuit » se gagne pareil sur la page du propriétaire et sur
 * la page publique.
 *
 * Recopié octet pour octet dans le backend
 * (`apps/backend/src/services/viewingStats/habits.ts`), qui le calcule avant de
 * jeter la grille ; aucun import. Verrou : `contractMirror.test.ts`.
 */

const HOURS_PER_DAY = 24;
/** Samedi et dimanche : les deux dernières lignes de la grille (lundi en tête). */
const WEEKEND_FIRST_DAY = 5;

/** Les moments de la journée, en heures locales : [début, fin). */
export const DAYPARTS = {
  morning: [5, 12],
  afternoon: [12, 18],
  evening: [18, 23],
  night: [23, 29], // 23 h → 5 h le lendemain
} as const;

export type Daypart = keyof typeof DAYPARTS;

/** Dans l'ordre d'une journée : c'est l'ordre de lecture, jamais celui des parts. */
export const DAYPART_ORDER: readonly Daypart[] = ["morning", "afternoon", "evening", "night"];

export function inDaypart(hour: number, part: Daypart): boolean {
  const [from, to] = DAYPARTS[part];
  return (hour >= from && hour < to) || (hour + 24 >= from && hour + 24 < to);
}

/** 22 h → 5 h : le trait « Oiseau de nuit ». */
export const isLateHour = (hour: number): boolean => hour >= 22 || hour < 5;

/** 5 h → 10 h : le trait « Lève-tôt ». */
export const isEarlyHour = (hour: number): boolean => hour >= 5 && hour < 10;

export interface ViewingHabits {
  /** Le temps mesuré derrière ces parts : le rythme ne se lit que sur la mesure. */
  measuredSeconds: number;
  /** Part (0..1) de chaque moment de la journée ; leur somme vaut 1. */
  dayparts: Record<Daypart, number>;
  /** Samedi et dimanche. */
  weekendShare: number;
  /** 22 h → 5 h. */
  lateShare: number;
  /** 5 h → 10 h. */
  earlyShare: number;
}

/** Les habitudes d'une grille jour × heure : 168 cases, lundi 0 h en tête. */
export function habitsOf(grid: readonly number[]): ViewingHabits {
  const byHour = new Array<number>(HOURS_PER_DAY).fill(0);
  let total = 0;
  let weekend = 0;
  grid.forEach((seconds, i) => {
    byHour[i % HOURS_PER_DAY] += seconds;
    if (Math.floor(i / HOURS_PER_DAY) >= WEEKEND_FIRST_DAY) weekend += seconds;
    total += seconds;
  });
  const share = (pick: (hour: number) => boolean): number =>
    total > 0 ? byHour.reduce((n, seconds, hour) => n + (pick(hour) ? seconds : 0), 0) / total : 0;

  return {
    measuredSeconds: total,
    dayparts: {
      morning: share((h) => inDaypart(h, "morning")),
      afternoon: share((h) => inDaypart(h, "afternoon")),
      evening: share((h) => inDaypart(h, "evening")),
      night: share((h) => inDaypart(h, "night")),
    },
    weekendShare: total > 0 ? weekend / total : 0,
    lateShare: share(isLateHour),
    earlyShare: share(isEarlyHour),
  };
}
