/**
 * La fiche d'une PERSONNE (acteur, réalisatrice, scénariste…), telle que
 * Jellyfin la connaît — pur, sans React, commun au web, au bureau et au mobile.
 *
 * Jellyfin rend la personne comme un item (`Type: "Person"`) : la biographie
 * dans `Overview`, la naissance dans `PremiereDate`, le décès dans `EndDate`,
 * le lieu de naissance dans `ProductionLocations`. Ces champs-là ne sont pas
 * demandés par la fiche d'un titre : la personne a sa propre requête.
 */

/** Ce que la page d'une personne lit de Jellyfin. */
export interface PersonDetails {
  Id: string;
  Name: string;
  Type?: string;
  Overview?: string;
  PremiereDate?: string;
  EndDate?: string;
  ProductionLocations?: string[];
  ProviderIds?: Record<string, string>;
  ImageTags?: Record<string, string>;
  ExternalUrls?: Array<{ Name: string; Url: string }>;
}

/** Une date de calendrier, sans heure ni fuseau — un anniversaire ne change pas d'un pays à l'autre. */
export interface CalendarDate {
  year: number;
  /** 1 à 12. */
  month: number;
  day: number;
}

export interface PersonLife {
  born: CalendarDate | null;
  died: CalendarDate | null;
  /** L'âge aujourd'hui, ou l'âge au décès. */
  age: number | null;
  birthPlace: string | null;
}

const DAY_MS = 86_400_000;

/**
 * Une date Jellyfin ramenée au JOUR le plus proche.
 *
 * Jellyfin stocke le minuit LOCAL du serveur converti en UTC : une naissance
 * au 1er juillet revient en `…-06-30T23:00:00Z` depuis un serveur à Paris. Lire
 * la partie date telle quelle recule d'un jour ; arrondir à midi UTC retombe
 * sur le bon jour pour tout fuseau entre −12 h et +12 h.
 */
export function readJellyfinDate(iso: string | null | undefined): CalendarDate | null {
  if (typeof iso !== "string" || iso.trim() === "") return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(Math.floor((ms + DAY_MS / 2) / DAY_MS) * DAY_MS);
  const year = d.getUTCFullYear();
  // Jellyfin pose `0001-01-01` là où il ne sait rien : ce n'est pas une date.
  if (year < 1800) return null;
  return { year, month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** L'âge révolu entre deux dates de calendrier. */
export function ageBetween(from: CalendarDate, to: CalendarDate): number {
  const beforeBirthday = to.month < from.month || (to.month === from.month && to.day < from.day);
  return to.year - from.year - (beforeBirthday ? 1 : 0);
}

export function toCalendarDate(date: Date): CalendarDate {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

/** Naissance, décès, âge et lieu de naissance — ce que Jellyfin sait, rien de plus. */
export function personLife(details: PersonDetails | null | undefined, today: CalendarDate): PersonLife {
  const born = readJellyfinDate(details?.PremiereDate);
  const died = readJellyfinDate(details?.EndDate);
  const until = died ?? today;
  const age = born !== null ? ageBetween(born, until) : null;
  const place = details?.ProductionLocations?.find((p) => typeof p === "string" && p.trim() !== "")?.trim() ?? null;
  return { born, died, age: age !== null && age >= 0 && age < 130 ? age : null, birthPlace: place };
}

/**
 * La date dans la langue de l'interface (« 1 juillet 1937 », « July 1, 1937 »).
 * Formatée en UTC à partir d'un minuit UTC : aucun fuseau ne la décale.
 */
export function formatCalendarDate(date: CalendarDate, locale: string): string {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day));
  try {
    return utc.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  } catch {
    return `${String(date.day).padStart(2, "0")}/${String(date.month).padStart(2, "0")}/${date.year}`;
  }
}

/**
 * La biographie en paragraphes : Jellyfin la rend avec des sauts de ligne
 * doublés (et parfois des `\r`). Les lignes vides ne font pas de paragraphe.
 */
export function biographyParagraphs(overview: string | null | undefined): string[] {
  if (typeof overview !== "string") return [];
  return overview
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter((p) => p !== "");
}
