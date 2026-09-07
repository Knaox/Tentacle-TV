type Translate = (key: string, options?: Record<string, unknown>) => string;

/** « Se supprime dans X » (relatif sous 24 h) ou « Se supprime le <date> ». */
export function scheduleText(scheduledAtSec: number, t: Translate, locale: string): string {
  const deltaMin = Math.max(0, Math.round((scheduledAtSec * 1000 - Date.now()) / 60_000));
  if (deltaMin < 60) return t("autoDeleteScheduledIn", { time: `${Math.max(1, deltaMin)} min` });
  if (deltaMin < 24 * 60) {
    const h = Math.floor(deltaMin / 60);
    const m = deltaMin % 60;
    return t("autoDeleteScheduledIn", { time: m > 0 ? `${h} h ${m} min` : `${h} h` });
  }
  const date = new Date(scheduledAtSec * 1000).toLocaleString(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return t("autoDeleteScheduledOn", { date });
}
