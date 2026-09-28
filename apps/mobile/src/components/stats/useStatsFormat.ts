import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { createStatsFormatter, statsLocale, type StatsFormatter } from "@tentacle-tv/shared";

export interface StatsFormat extends StatsFormatter {
  t: ReturnType<typeof useTranslation>["t"];
}

/**
 * Les mises en forme de l'écran de statistiques — celles du web, à
 * l'identique (`createStatsFormatter`, shared). Aucun `Intl` : Hermes n'en a
 * qu'une partie (ni `RelativeTimeFormat` ni `DisplayNames`), les noms de
 * langues arrivent déjà traduits du serveur.
 */
export function useStatsFormat(): StatsFormat {
  const { t, i18n } = useTranslation("stats");
  const locale = statsLocale(i18n.language);
  return useMemo(() => ({ ...createStatsFormatter(t, locale), t }), [t, locale]);
}
