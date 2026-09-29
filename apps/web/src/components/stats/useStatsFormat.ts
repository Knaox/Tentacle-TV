import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { createStatsFormatter, statsLocale, type StatsFormatter } from "@tentacle-tv/shared";
import { useStatsVoice } from "./statsVoice";

export interface StatsFormat extends StatsFormatter {
  t: ReturnType<typeof useTranslation>["t"];
}

/**
 * Les mises en forme de la page, dans la langue de l'interface — celles du
 * mobile, à l'identique (`createStatsFormatter`, shared) : aucun `Intl`, pour
 * que les deux clients écrivent exactement la même chose. Les textes suivent
 * la voix de la page (`statsVoice.ts`) : « Vos genres » chez le propriétaire,
 * « Ses genres » sur la page publique d'un partage.
 */
export function useStatsFormat(): StatsFormat {
  const { namespaces, vars } = useStatsVoice();
  const { t, i18n } = useTranslation(namespaces as string[]);
  const locale = statsLocale(i18n.language);
  return useMemo(() => {
    const voiced = vars
      ? ((key: string, options?: Record<string, unknown>) => t(key, { ...vars, ...options })) as typeof t
      : t;
    return { ...createStatsFormatter(voiced, locale), t: voiced };
  }, [t, locale, vars]);
}
