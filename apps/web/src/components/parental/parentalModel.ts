import type { AccessSchedule, ParentalRatingOption, ScheduleDay } from "@tentacle-tv/api-client";

/**
 * Les règles PURES du contrôle parental, communes à la fiche d'un compte
 * (administration) et au contrôle parental d'un invité (Famille) : l'échelle
 * des notes de Jellyfin regroupée par niveau, les étiquettes, les plages
 * horaires. Aucun React ici.
 */

/** Un niveau de l'échelle : plusieurs pays y posent leur nom (« 12 », « PG-13 »…). */
export interface RatingChoice {
  key: string;
  score: number;
  subScore: number | null;
  names: string[];
}

export function ratingKey(score: number, subScore: number | null): string {
  return subScore === null ? `${score}` : `${score}.${subScore}`;
}

/**
 * La table de Jellyfin regroupée par (score, sous-score), du plus permissif au
 * moins, sans doublon de nom. Les notes « 0 » qui ne restreignent rien (tout
 * public) restent : c'est le choix le plus strict qui laisse les titres notés.
 */
export function ratingChoices(options: readonly ParentalRatingOption[]): RatingChoice[] {
  const byKey = new Map<string, RatingChoice>();
  for (const option of options) {
    const subScore = option.subScore ?? null;
    const key = ratingKey(option.score, subScore);
    const choice = byKey.get(key) ?? { key, score: option.score, subScore, names: [] };
    if (!choice.names.includes(option.name)) choice.names.push(option.name);
    byKey.set(key, choice);
  }
  return [...byKey.values()].sort((a, b) => a.score - b.score || (a.subScore ?? -1) - (b.subScore ?? -1));
}

/**
 * Le niveau qui correspond à la note posée. Une note que la table ne connaît
 * plus (autre pays de métadonnées) reste montrée telle quelle — jamais
 * remplacée en silence par une autre.
 */
export function currentRating(
  choices: readonly RatingChoice[],
  score: number | null,
  subScore: number | null,
): RatingChoice | null {
  if (score === null) return null;
  const key = ratingKey(score, subScore);
  return choices.find((choice) => choice.key === key) ?? { key, score, subScore, names: [] };
}

/** Les noms d'un niveau, raccourcis : « 12, PG-13, FSK 12 +2 ». */
export function ratingLabel(choice: RatingChoice, max = 3): string {
  const shown = choice.names.slice(0, max).join(", ");
  const rest = choice.names.length - max;
  return rest > 0 ? `${shown} +${rest}` : shown;
}

/** Une étiquette telle que Jellyfin la compare : espaces resserrés, casse gardée. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Ajoute une étiquette, sans doublon (casse ignorée) ; la liste inchangée si vide ou déjà là. */
export function addTag(list: readonly string[], raw: string): string[] {
  const tag = normalizeTag(raw);
  if (!tag || list.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return [...list];
  return [...list, tag];
}

export function removeTag(list: readonly string[], tag: string): string[] {
  return list.filter((existing) => existing !== tag);
}

/** Les suggestions d'étiquettes : connues, absentes de la liste, qui contiennent la saisie. */
export function tagSuggestions(known: readonly string[], list: readonly string[], query: string, max = 6): string[] {
  const q = normalizeTag(query).toLowerCase();
  const taken = new Set(list.map((tag) => tag.toLowerCase()));
  return known.filter((tag) => !taken.has(tag.toLowerCase()) && (!q || tag.toLowerCase().includes(q))).slice(0, max);
}

/** Ajoute ou retire un identifiant d'une liste, sans doublon, en gardant l'ordre. */
export function toggleInList(list: readonly string[], id: string, on: boolean): string[] {
  const without = list.filter((existing) => existing !== id);
  return on ? [...without, id] : without;
}

export const SCHEDULE_DAYS: readonly ScheduleDay[] = [
  "Everyday", "Weekday", "Weekend", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

/** Les heures proposées, à la demi-heure : 0, 0,5 … 24. */
export const SCHEDULE_HOURS: readonly number[] = Array.from({ length: 49 }, (_, index) => index / 2);

/** 7,5 → « 07:30 » ; 24 → « 24:00 » (minuit, fin de journée). */
export function formatHour(hour: number): string {
  const whole = Math.floor(hour);
  const minutes = Math.round((hour - whole) * 60);
  return `${String(whole).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function scheduleIsValid(schedule: AccessSchedule): boolean {
  return schedule.startHour >= 0 && schedule.endHour <= 24 && schedule.startHour < schedule.endHour;
}

export function sameSchedule(a: AccessSchedule, b: AccessSchedule): boolean {
  return a.dayOfWeek === b.dayOfWeek && a.startHour === b.startHour && a.endHour === b.endHour;
}

/** Ajoute une plage valide et nouvelle ; sinon la liste inchangée. */
export function addSchedule(list: readonly AccessSchedule[], schedule: AccessSchedule): AccessSchedule[] {
  if (!scheduleIsValid(schedule) || list.some((existing) => sameSchedule(existing, schedule))) return [...list];
  return [...list, schedule];
}

export function removeSchedule(list: readonly AccessSchedule[], index: number): AccessSchedule[] {
  return list.filter((_, at) => at !== index);
}

/** Bits par seconde ↔ Mbit/s affichés (0 : sans limite). */
export function mbpsFromBits(bits: number): number {
  return bits > 0 ? Math.round(bits / 100_000) / 10 : 0;
}

export function bitsFromMbps(mbps: number): number {
  return mbps > 0 ? Math.round(mbps * 1_000_000) : 0;
}
