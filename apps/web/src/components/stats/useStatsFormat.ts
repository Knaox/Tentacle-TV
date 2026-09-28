import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { createStatsFormatter, statsLocale, type StatsFormatter } from "@tentacle-tv/shared";

export interface StatsFormat extends StatsFormatter {
  t: ReturnType<typeof useTranslation>["t"];
}

/**
 * Les mises en forme de la page, dans la langue de l'interface — celles du
 * mobile, à l'identique (`createStatsFormatter`, shared) : aucun `Intl`, pour
 * que les deux clients écrivent exactement la même chose.
 */
export function useStatsFormat(): StatsFormat {
  const { t, i18n } = useTranslation("stats");
  const locale = statsLocale(i18n.language);
  return useMemo(() => ({ ...createStatsFormatter(t, locale), t }), [t, locale]);
}
