import { GUEST_SCHEDULE_NEVER, type AccessScheduleDay, type AccessScheduleDto, type UnratedItemType, type UserRightsOptions } from "@tentacle-tv/shared";

type ParentalRatingOption = UserRightsOptions["parentalRatings"][number];

/**
 * Les règles PURES du contrôle parental, communes à la fiche d'un compte
 * (administration) et au contrôle parental d'un invité (Famille) : l'échelle
 * des notes de Jellyfin regroupée par niveau, les étiquettes, les plages
 * horaires. Aucun React ici.
 *
 * Tout se montre COMME l'onglet « Contrôle parental » du tableau de bord de
 * Jellyfin 10.11 (relevé sur un Jellyfin jetable, 2026-10-15) : les noms d'un
 * même niveau réunis par « / », ses sept types non classés dans son ordre, ses
 * jours et ses heures à la demi-heure. Une valeur posée dans Jellyfin se relit
 * ici telle qu'il la montre.
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

/**
 * Les noms d'un niveau, comme Jellyfin les écrit : tous, réunis par « / »
 * (« 0+/Public Averti/Tous Publics/TP/U »). `max` raccourcit pour un résumé
 * d'une ligne : « TV-14-D/TV-14-L +13 ».
 */
export function ratingLabel(choice: RatingChoice, max?: number): string {
  if (max === undefined || choice.names.length <= max) return choice.names.join("/");
  return `${choice.names.slice(0, max).join("/")} +${choice.names.length - max}`;
}

/**
 * Les types non classés que Jellyfin propose de bloquer, dans SON ordre (le
 * tableau de bord ne montre ni `LiveTvProgram` ni `Other`).
 */
export const JELLYFIN_UNRATED_TYPES: readonly UnratedItemType[] = [
  "Book", "ChannelContent", "LiveTvChannel", "Movie", "Music", "Trailer", "Series",
];

/**
 * Les cases à montrer : celles de Jellyfin que le serveur propose, dans
 * l'ordre de Jellyfin, puis tout type posé autrement (par l'API) — visible,
 * donc décochable, jamais perdu en silence.
 */
export function unratedTypesShown(offered: readonly UnratedItemType[], value: readonly UnratedItemType[]): UnratedItemType[] {
  const shown = JELLYFIN_UNRATED_TYPES.filter((type) => offered.includes(type));
  return [...shown, ...value.filter((type) => !shown.includes(type))];
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
export function toggleInList<T extends string>(list: readonly T[], id: T, on: boolean): T[] {
  const without = list.filter((existing) => existing !== id);
  return on ? [...without, id] : without;
}

/** Les jours, dans l'ordre de Jellyfin : la semaine depuis dimanche, puis tous les jours, la semaine, le week-end. */
export const SCHEDULE_DAYS: readonly AccessScheduleDay[] = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Everyday", "Weekday", "Weekend",
];

/** Les heures proposées, à la demi-heure : 0, 0,5 … 24. */
export const SCHEDULE_HOURS: readonly number[] = Array.from({ length: 49 }, (_, index) => index / 2);

/**
 * Une heure comme Jellyfin l'écrit : 7,5 → « 7:30 », 20 → « 20:00 », et 24
 * (minuit, la fin de la journée) → « 0:00 ». Une heure hors de la
 * demi-heure, posée par l'API, se lit à la minute.
 */
export function formatHour(hour: number): string {
  const whole = Math.floor(hour);
  const minutes = Math.round((hour - whole) * 60);
  return `${whole % 24}:${String(minutes).padStart(2, "0")}`;
}

export function scheduleIsValid(schedule: AccessScheduleDto): boolean {
  return schedule.startHour >= 0 && schedule.endHour <= 24 && schedule.startHour < schedule.endHour;
}

export function sameSchedule(a: AccessScheduleDto, b: AccessScheduleDto): boolean {
  return a.dayOfWeek === b.dayOfWeek && a.startHour === b.startHour && a.endHour === b.endHour;
}

/** Ajoute une plage valide et nouvelle ; sinon la liste inchangée. */
/**
 * « Jamais » : la plage sentinelle (`GUEST_SCHEDULE_NEVER`, dimanche 24 h – 24 h)
 * que le serveur pose quand les plages d'un invité et celles de son créateur ne
 * se recoupent pas — une liste vide voudrait dire « à toute heure » chez
 * Jellyfin. Elle se dit « Jamais », jamais « Dimanche ».
 */
export function isNeverSchedule(list: readonly AccessScheduleDto[]): boolean {
  return list.length > 0 && list.every((schedule) => GUEST_SCHEDULE_NEVER.some((never) => sameSchedule(schedule, never)));
}

export function addSchedule(list: readonly AccessScheduleDto[], schedule: AccessScheduleDto): AccessScheduleDto[] {
  // Une vraie plage remplace « Jamais » : elle ne s'y ajoute pas.
  const base = isNeverSchedule(list) ? [] : list;
  if (!scheduleIsValid(schedule) || base.some((existing) => sameSchedule(existing, schedule))) return [...list];
  return [...base, schedule];
}

export function removeSchedule(list: readonly AccessScheduleDto[], index: number): AccessScheduleDto[] {
  return list.filter((_, at) => at !== index);
}

/** Bits par seconde ↔ Mbit/s affichés (0 : sans limite). */
export function mbpsFromBits(bits: number): number {
  return bits > 0 ? Math.round(bits / 100_000) / 10 : 0;
}

export function bitsFromMbps(mbps: number): number {
  return mbps > 0 ? Math.round(mbps * 1_000_000) : 0;
}
