import type { ViewingStats } from "../types/viewingStats";
import { analyzeRhythm } from "./insights";

/**
 * Le « profil de spectateur » : trois traits au plus, chacun gagné sur les
 * chiffres de la période et accompagné du chiffre qui le justifie (« 62 % de
 * votre temps après 22 h »). Jamais un trait sans preuve, jamais sur trop peu
 * de données : un compte à vingt minutes n'est l'« oiseau de nuit » de
 * personne. Et toujours sur la DURÉE réelle, jamais sur un compte
 * d'épisodes : vingt épisodes de trois minutes ne font pas un marathonien.
 */

export type ViewerBadgeKey =
  | "nightOwl"
  | "earlyBird"
  | "weekend"
  | "binger"
  | "regular"
  | "cinephile"
  | "seriesAddict"
  | "animeFan"
  | "loyal"
  | "explorer"
  | "vintage"
  | "polyglot"
  | "worldly";

export interface ViewerBadge {
  key: ViewerBadgeKey;
  /** Au-delà de 1, le trait est acquis ; plus c'est haut, plus il est marqué. */
  strength: number;
  /** La part qui le justifie (0..1), quand c'en est une. */
  share?: number;
  /** Le compte qui le justifie (jours, genres, langues, pays). */
  count?: number;
  /** La durée qui le justifie (le marathon). */
  seconds?: number;
  /** Le nom qui l'accompagne (une série, un titre, une décennie). */
  label?: string;
}

/** En dessous de deux heures sur la période, pas de trait : trop peu pour dire. */
export const BADGES_MIN_SECONDS = 2 * 3600;
export const BADGES_MAX = 3;
/** Marathonien : trois heures d'une même série dans la journée. */
export const BINGER_SECONDS = 3 * 3600;
/** Une langue entendue ou un pays d'origine compte pour un trait à partir de 10 % du temps. */
const DIVERSITY_SHARE = 0.1;

export function viewerBadges(stats: ViewingStats, max = BADGES_MAX): ViewerBadge[] {
  const total = stats.totals.seconds;
  if (total < BADGES_MIN_SECONDS) return [];
  const out: ViewerBadge[] = [];
  const add = (b: ViewerBadge) => {
    if (b.strength >= 1) out.push(b);
  };

  // Le rythme ne se lit que sur le temps MESURÉ.
  const rhythm = analyzeRhythm(stats.rhythm.grid);
  if (rhythm.totalSeconds >= BADGES_MIN_SECONDS) {
    add({ key: "nightOwl", strength: rhythm.lateShare / 0.35, share: rhythm.lateShare });
    add({ key: "earlyBird", strength: rhythm.earlyShare / 0.25, share: rhythm.earlyShare });
    add({ key: "weekend", strength: rhythm.weekendShare / 0.5, share: rhythm.weekendShare });
  }

  const binge = stats.records.binge;
  if (binge && binge.seconds > 0) {
    add({ key: "binger", strength: binge.seconds / BINGER_SECONDS, seconds: binge.seconds, label: binge.seriesName });
  }
  const streak = stats.records.longestStreak;
  if (streak) add({ key: "regular", strength: streak.days / 7, count: streak.days });

  const { movieSeconds, seriesSeconds, animeSeconds } = stats.split;
  if (stats.totals.movies >= 3) add({ key: "cinephile", strength: movieSeconds / total / 0.6, share: movieSeconds / total });
  add({ key: "seriesAddict", strength: seriesSeconds / total / 0.7, share: seriesSeconds / total });
  add({ key: "animeFan", strength: animeSeconds / total / 0.35, share: animeSeconds / total });

  const top = stats.topSeries[0];
  if (top && total >= 5 * 3600) add({ key: "loyal", strength: top.seconds / total / 0.4, share: top.seconds / total, label: top.name });

  const genres = stats.genres;
  if (genres.length >= 6 && genres[0].share < 0.4) {
    add({ key: "explorer", strength: 1 + (0.4 - genres[0].share), count: genres.length });
  }

  const oldest = stats.decades.filter((d) => d.decade < 2000).sort((a, b) => b.seconds - a.seconds)[0];
  if (oldest) add({ key: "vintage", strength: oldest.seconds / total / 0.3, share: oldest.seconds / total, label: String(oldest.decade) });

  // Ce qu'on ENTEND (la piste lue), jamais la langue originale des titres.
  const heard = stats.listening.languages.filter((l) => l.share >= DIVERSITY_SHARE).length;
  add({ key: "polyglot", strength: heard / 3, count: heard });
  const countries = stats.origins.countries.filter((c) => c.share >= DIVERSITY_SHARE).length;
  add({ key: "worldly", strength: countries / 4, count: countries });

  return out.sort((a, b) => b.strength - a.strength).slice(0, max);
}
