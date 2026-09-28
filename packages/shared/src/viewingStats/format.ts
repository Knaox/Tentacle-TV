/**
 * Mises en forme des statistiques de visionnage — une seule lecture pour le
 * web et le mobile.
 *
 * Écrites à la main, SANS `Intl` : Hermes (le mobile) n'embarque qu'une partie
 * d'ECMA-402 (pas de `RelativeTimeFormat`, pas de `DisplayNames`), et un
 * séparateur de milliers qui change selon le moteur ferait mentir les tests.
 * Le français espace les milliers et le signe % (espaces insécables fines),
 * l'anglais met une virgule et colle le %.
 */

export type StatsLocale = "fr" | "en";

const NARROW_NBSP = " ";

/** « fr » pour toute langue française (« fr-CA »…), « en » sinon. */
export function statsLocale(language: string | undefined | null): StatsLocale {
  return language?.toLowerCase().startsWith("fr") ? "fr" : "en";
}

/** 1284 → « 1 284 » / « 1,284 » ; 2.5 avec une décimale → « 2,5 » / « 2.5 ». */
export function formatStatNumber(value: number, locale: StatsLocale, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, locale === "fr" ? NARROW_NBSP : ",");
  const sign = value < 0 ? "-" : "";
  return frac ? `${sign}${grouped}${locale === "fr" ? "," : "."}${frac}` : `${sign}${grouped}`;
}

/** 0.324 → « 32 % » / « 32% » ; une part non nulle sous 1 % → « < 1 % ». */
export function formatStatPercent(share: number, locale: StatsLocale): string {
  const pct = Math.round(share * 100);
  const sep = locale === "fr" ? NARROW_NBSP : "";
  if (share > 0 && pct === 0) return `< 1${sep}%`;
  return `${pct}${sep}%`;
}

export interface WatchTimeParts {
  days: number;
  hours: number;
  minutes: number;
}

export function watchTimeParts(seconds: number): WatchTimeParts {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  return { days: Math.floor(totalHours / 24), hours: totalHours % 24, minutes: totalMinutes % 60 };
}

/**
 * Durée lisible d'un coup d'œil : « 2 j 4 h » au-delà d'un jour, « 3 h 20 »
 * (« 3 h 20 min ») au-delà d'une heure, « 45 min » en dessous. Jamais de
 * secondes : sur du visionnage, elles n'apprennent rien.
 */
export function formatWatchTime(seconds: number, locale: StatsLocale): string {
  if (seconds < 60) return "< 1 min";
  const { days, hours, minutes } = watchTimeParts(seconds);
  const dayUnit = locale === "fr" ? "j" : "d";
  if (days > 0) return hours > 0 ? `${days} ${dayUnit} ${hours} h` : `${days} ${dayUnit}`;
  if (hours > 0) {
    if (minutes === 0) return `${hours} h`;
    return locale === "fr" ? `${hours} h ${String(minutes).padStart(2, "0")}` : `${hours} h ${minutes} min`;
  }
  return `${minutes} min`;
}

/**
 * Le chiffre du héros et son unité : des heures dès qu'il y en a une (une
 * décimale sous dix heures), des minutes sinon. L'unité se traduit côté
 * client, au pluriel voulu par `count`.
 */
export function heroFigure(seconds: number, locale: StatsLocale): { value: string; unit: "hours" | "minutes"; count: number } {
  const hours = seconds / 3600;
  if (hours >= 10) {
    const whole = Math.floor(hours);
    return { value: formatStatNumber(whole, locale), unit: "hours", count: whole };
  }
  if (hours >= 1) {
    const tenth = Math.floor(hours * 10) / 10;
    return { value: formatStatNumber(tenth, locale, Number.isInteger(tenth) ? 0 : 1), unit: "hours", count: tenth };
  }
  const minutes = Math.floor(seconds / 60);
  return { value: formatStatNumber(minutes, locale), unit: "minutes", count: minutes };
}

/** « AAAA-MM-JJ » (ou « AAAA-MM », « AAAA ») → composantes ; mois de 0 à 11. */
export function parseDateKey(key: string): { year: number; month: number | null; day: number | null } {
  const [y, m, d] = key.split("-").map(Number);
  return { year: y, month: m ? m - 1 : null, day: d || null };
}

/** Jour de semaine (0 = lundi) d'une date « AAAA-MM-JJ », sans fuseau. */
export function weekdayOfDateKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}
