/**
 * Deux faits de la fiche média calculés à l'identique par le web et le mobile
 * — pur. La SORTIE : la date d'un film ou d'un épisode, les années de
 * diffusion d'une série. La FIN : l'heure à laquelle le titre se terminerait
 * s'il était lancé maintenant, depuis la reprise s'il y en a une.
 */

import type { MediaItem } from "../types/media";
import { formatCalendarDate, readJellyfinDate } from "../person/personProfile";

const TICKS_PER_SECOND = 10_000_000;

/** Film, épisode : « 23 septembre 1994 ». Série : « 2008 – 2013 », « 2019 – » en cours. */
export function releaseLabel(item: Pick<MediaItem, "Type" | "ProductionYear" | "PremiereDate" | "EndDate" | "Status">, locale: string): string | null {
  if (item.Type === "Series") {
    const start = item.ProductionYear;
    if (!start) return null;
    const end = readJellyfinDate(item.EndDate)?.year;
    if (item.Status === "Ended" && end && end !== start) return `${start} – ${end}`;
    return item.Status === "Continuing" ? `${start} –` : String(start);
  }
  const date = readJellyfinDate(item.PremiereDate);
  if (date) return formatCalendarDate(date, locale);
  return item.ProductionYear ? String(item.ProductionYear) : null;
}

/** L'instant de fin si l'on lançait maintenant ; `null` sans durée ou s'il reste moins d'une minute. */
export function playbackEndsAt(item: Pick<MediaItem, "Type" | "RunTimeTicks" | "UserData">, now: number): Date | null {
  if (item.Type === "Series" || item.Type === "BoxSet" || !item.RunTimeTicks) return null;
  const remaining = (item.RunTimeTicks - (item.UserData?.PlaybackPositionTicks ?? 0)) / TICKS_PER_SECOND;
  if (!(remaining > 60)) return null;
  return new Date(now + remaining * 1000);
}
