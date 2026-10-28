/** Octave mobile — « 12 titres · 48 min » (les mots du bureau, `totalDurationParts` partagé). */

import { useTranslation } from "react-i18next";
import { totalDurationParts } from "@tentacle-tv/shared/octave";

export function useCountAndDuration(count: number, durationMs: number | null): string {
  const { t } = useTranslation("music");
  const parts = [t("count.tracks", { count })];
  if (durationMs && durationMs > 0) {
    const { hours, minutes } = totalDurationParts(durationMs);
    parts.push(hours > 0 ? t("count.hoursMinutes", { hours, minutes }) : t("count.minutes", { minutes }));
  }
  return parts.join(" · ");
}
