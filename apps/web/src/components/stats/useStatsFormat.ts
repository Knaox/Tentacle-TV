import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  formatStatNumber,
  formatStatPercent,
  formatWatchTime,
  parseDateKey,
  statsLocale,
  weekdayOfDateKey,
  type StatsLocale,
  type ViewingStatsTimelineUnit,
} from "@tentacle-tv/shared";

export interface StatsFormat {
  locale: StatsLocale;
  t: ReturnType<typeof useTranslation>["t"];
  duration: (seconds: number) => string;
  number: (value: number, decimals?: number) => string;
  percent: (share: number) => string;
  /** « 26 sept. » / « Sep 26 » ; avec l'année sur demande. */
  day: (key: string, withYear?: boolean) => string;
  /** Un instant ISO, dit au jour LOCAL de l'appareil (« 26 sept. »). */
  isoDay: (iso: string, withYear?: boolean) => string;
  weekday: (index: number) => string;
  weekdayShort: (index: number) => string;
  /** Libellé d'axe d'un pas de frise (« 26 », « sept. », « 2026 »). */
  tick: (unit: ViewingStatsTimelineUnit, key: string) => string;
  /** Libellé complet d'un pas, pour l'infobulle (« samedi 26 sept. », « septembre 2026 »). */
  bucket: (unit: ViewingStatsTimelineUnit, key: string) => string;
}

/**
 * Les mises en forme de la page, dans la langue de l'interface : nombres,
 * durées et parts viennent de `@tentacle-tv/shared` (les mêmes qu'au mobile),
 * mois et jours des traductions — aucun `Intl`, pour que les deux clients
 * écrivent exactement la même chose.
 */
export function useStatsFormat(): StatsFormat {
  const { t, i18n } = useTranslation("stats");
  const locale = statsLocale(i18n.language);
  return useMemo(() => {
    const day = (key: string, withYear = false) => {
      const { year, month, day: d } = parseDateKey(key);
      return t(withYear ? "dateDayYear" : "dateDay", { day: d, month: t(`monthShort_${month ?? 0}`), year });
    };
    return {
      locale,
      t,
      duration: (s) => formatWatchTime(s, locale),
      number: (v, decimals = 0) => formatStatNumber(v, locale, decimals),
      percent: (share) => formatStatPercent(share, locale),
      day,
      isoDay: (iso, withYear = false) => {
        const d = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, "0");
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
    } satisfies StatsFormat;
  }, [t, locale]);
}
