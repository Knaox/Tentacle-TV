import type { TFunction } from "i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { episodeLabel } from "../hero/heroModel";

/**
 * Les légendes des cartes de l'accueil — ce qu'on lit sous la vignette, rangée
 * par rangée : où l'on en est d'une reprise, quel épisode suit, ce qu'apporte
 * un lot de nouveautés.
 */

const TICKS_PER_MINUTE = 60 * 10_000_000;

export const yearOf = (item: MediaItem): string | undefined => (item.ProductionYear ? String(item.ProductionYear) : undefined);

/** « 18 min restantes », ou rien s'il n'y a rien à reprendre. */
export function remainingLabel(item: MediaItem, t: TFunction): string | undefined {
  const pct = item.UserData?.PlayedPercentage ?? 0;
  if (!item.RunTimeTicks || pct <= 0) return undefined;
  const minutes = Math.max(1, Math.round((item.RunTimeTicks * (1 - pct / 100)) / TICKS_PER_MINUTE));
  return t("media:detailRemainingMinutes", { count: minutes });
}

/** Reprendre : « S2 · É3 — 18 min restantes », « 2019 — 42 min restantes ». */
export function resumeSubtitle(item: MediaItem, t: TFunction): string {
  const where = item.Type === "Episode" ? episodeLabel(item, false) : yearOf(item);
  return [where, remainingLabel(item, t)].filter(Boolean).join(" — ");
}

/** Un épisode se repère par son code (et son nom), un film ou une série par son année. */
export function itemSubtitle(item: MediaItem, withEpisodeName = false): string | undefined {
  return item.Type === "Episode" ? episodeLabel(item, withEpisodeName) : yearOf(item);
}

/** Derniers ajouts : « +3 épisodes » pour un lot, sinon le repère de l'item. */
export function latestSubtitle(item: MediaItem, t: TFunction): string | undefined {
  const added = item.RecentlyAddedCount ?? 0;
  return added > 1 ? t("common:addedEpisodes", { count: added }) : itemSubtitle(item, true);
}
