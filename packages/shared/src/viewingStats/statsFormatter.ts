import type { ViewingStatsTimelineUnit } from "../types/viewingStats";
import {
  formatStatNumber,
  formatStatPercent,
  formatWatchTime,
  parseDateKey,
  weekdayOfDateKey,
  type StatsLocale,
} from "./format";

/** La traduction de l'espace `stats` (le `t` de react-i18next). */
export type StatsTranslate = (key: string, options?: Record<string, unknown>) => string;

export interface StatsFormatter {
  locale: StatsLocale;
  duration: (seconds: number) => string;
  number: (value: number, decimals?: number) => string;
  percent: (share: number) => string;
  /** « 26 sept. » / « Sep 26 » ; avec l'année sur demande. Une clé au mois (« AAAA-MM ») : « mars 2026 ». */
  day: (key: string, withYear?: boolean) => string;
  /** Un instant ISO, dit au jour LOCAL de l'appareil. */
  isoDay: (iso: string, withYear?: boolean) => string;
  weekday: (index: number) => string;
  weekdayShort: (index: number) => string;
  /** Libellé d'axe d'un pas de frise (« 26 », « sept. », « 2026 »). */
  tick: (unit: ViewingStatsTimelineUnit, key: string) => string;
  /** Libellé complet d'un pas (« samedi 26 sept. », « septembre 2026 »). */
  bucket: (unit: ViewingStatsTimelineUnit, key: string) => string;
}

/**
 * Les mises en forme de la page de statistiques, une seule fois pour le web
 * et le mobile : nombres, durées et parts à la main (sans `Intl`, absent en
 * partie de Hermes), mois et jours tirés des traductions. Le jour « local »
 * d'un instant passe par les accesseurs locaux de `Date`, qui marchent
 * partout.
 */
export function createStatsFormatter(t: StatsTranslate, locale: StatsLocale): StatsFormatter {
  const day = (key: string, withYear = false) => {
    const { year, month, day: d } = parseDateKey(key);
    // Une date au mois (« AAAA-MM » : les records d'une page partagée) se dit au mois, année comprise.
    if (d === null) return t("dateMonth", { month: t(`month_${month ?? 0}`), year });
    return t(withYear ? "dateDayYear" : "dateDay", { day: d, month: t(`monthShort_${month ?? 0}`), year });
  };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    locale,
    duration: (s) => formatWatchTime(s, locale),
    number: (v, decimals = 0) => formatStatNumber(v, locale, decimals),
    percent: (share) => formatStatPercent(share, locale),
    day,
    isoDay: (iso, withYear = false) => {
      const d = new Date(iso);
      return day(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, withYear);
    },
    weekday: (i) => t(`weekday_${i}`),
    weekdayShort: (i) => t(`weekdayShort_${i}`),
    tick: (unit, key) => {
      const p = parseDateKey(key);
      if (unit === "day") return String(p.day ?? "");
      if (unit === "month") return t(`monthShort_${p.month ?? 0}`);
      return String(p.year);
    },
    bucket: (unit, key) => {
      const p = parseDateKey(key);
      if (unit === "day") return `${t(`weekday_${weekdayOfDateKey(key)}`)} ${day(key)}`;
      if (unit === "month") return t("dateMonth", { month: t(`month_${p.month ?? 0}`), year: p.year });
      return String(p.year);
    },
  };
}
