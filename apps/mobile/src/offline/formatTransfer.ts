import { i18n } from "@tentacle-tv/shared";
import { formatBytes } from "./formatBytes";

/** Le débit, en unités de taille par seconde — « 4,20 Gio/s » n'arrivera pas. */
export function formatRate(bytesPerSecond: number | null): string | null {
  if (bytesPerSecond === null || bytesPerSecond <= 0) return null;
  return i18n.t("offline:transferRate", { rate: formatBytes(bytesPerSecond) });
}

/**
 * Le temps restant, arrondi à ce qu'on peut honnêtement promettre : une
 * estimation à la seconde près sur un transfert d'une heure serait fausse dès
 * la seconde suivante.
 */
export function formatTimeLeft(etaMs: number | null): string | null {
  if (etaMs === null || !Number.isFinite(etaMs) || etaMs <= 0) return null;
  const totalMinutes = Math.round(etaMs / 60_000);
  if (totalMinutes < 1) return i18n.t("offline:timeLeftSeconds");
  if (totalMinutes < 60) return i18n.t("offline:timeLeftMinutes", { minutes: totalMinutes });
  return i18n.t("offline:timeLeftHours", {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  });
}
