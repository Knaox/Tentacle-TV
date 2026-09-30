import type { TFunction } from "i18next";
import type { useJellyfinClient } from "@tentacle-tv/api-client";
import { extractMediaQuality, formatCommunityRating, formatDuration, formatEpisodeCode, type MediaItem } from "@tentacle-tv/shared";
import { isLogoLegibleOnDark } from "../../redesign/color/artworkPalette";
import type { HeroModel } from "../../redesign/hero/HeroBanner";
import type { MetaItem } from "../../redesign/hero/MetaLine";
import { backdropUriOf, blurHashOf, logoUriOf, paletteOfItem, progressOf } from "../cards/cardArtwork";

/**
 * Le héros d'une œuvre, tel que `HeroBanner` l'attend : son art (celui de la
 * SÉRIE pour un épisode — logo, fond, genres), la ligne de métadonnées, la
 * reprise, et les trois gestes (Lecture ou Reprendre, Plus d'infos, Ma liste).
 */

type ImageClient = ReturnType<typeof useJellyfinClient>;

/** « S01E02 · Nom » — le repère d'un épisode. */
export function episodeLabel(item: MediaItem, withName = true): string {
  const code = formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber);
  return withName && item.Name ? `${code} · ${item.Name}` : code;
}

/** « 2024 · 16+ · 2 h 12 · Thriller, Drame · ★ 7,4 · 4K HDR Atmos VF » */
export function metaOf(item: MediaItem, t: TFunction, options: { genres?: number; quality?: boolean } = {}): MetaItem[] {
  const meta: MetaItem[] = [];
  if (item.ProductionYear) meta.push(String(item.ProductionYear));
  if (item.OfficialRating) meta.push({ badge: item.OfficialRating });
  if (item.Type === "Series") {
    const seasons = item.ChildCount ?? 0;
    if (seasons > 0) meta.push(t("common:seasonsCount", { count: seasons }));
  } else {
    const duration = formatDuration(item.RunTimeTicks);
    if (duration) meta.push(duration);
  }
  const genres = (item.Genres ?? []).slice(0, options.genres ?? 2);
  if (genres.length) meta.push(genres.join(", "));
  if (item.CommunityRating) meta.push({ rating: formatCommunityRating(item.CommunityRating) });
  if (options.quality !== false) {
    const quality = extractMediaQuality(item);
    if (quality.resolution === "4K") meta.push({ badge: "4K", strong: true });
    if (quality.isDolbyVision) meta.push({ badge: "Dolby Vision" });
    else if (quality.isHDR) meta.push({ badge: "HDR" });
    if (quality.isDolbyAtmos) meta.push({ badge: "Atmos" });
    else if (quality.surroundLabel) meta.push({ badge: quality.surroundLabel });
    for (const label of quality.audioLabels.slice(0, 2)) meta.push({ badge: label.token });
  }
  return meta;
}

/** Le logo, seulement s'il se lit sur la scène sombre — sinon le titre s'écrit. */
export function legibleLogoOf(client: ImageClient, item: MediaItem): string | undefined {
  const uri = logoUriOf(client, item);
  return uri && isLogoLegibleOnDark(blurHashOf(item, "Logo")) ? uri : undefined;
}

export interface HeroInput {
  /** Ce qui se lit : le film, la série, ou l'épisode à reprendre. */
  item: MediaItem;
  /** Son art : la série d'un épisode quand elle est chargée, sinon l'item. */
  art: MediaItem;
  kicker?: string;
  reason?: string;
  page?: HeroModel["page"];
  /** L'œuvre est dans Ma liste (`useCardToggles(art).watchlist`). */
  inWatchlist: boolean;
}

export function heroModelOf(client: ImageClient, t: TFunction, { item, art, kicker, reason, page, inWatchlist }: HeroInput): HeroModel {
  const isEpisode = item.Type === "Episode";
  const progress = progressOf(item);
  // Un épisode garde sa qualité et son repère ; le reste vient de sa série.
  const meta = isEpisode
    ? [episodeLabel(item), ...metaOf(art, t, { quality: false }), ...metaOf(item, t).filter((entry) => typeof entry === "object" && "badge" in entry)]
    : metaOf(art, t);
  return {
    id: item.Id,
    kicker,
    reason,
    title: isEpisode ? item.SeriesName ?? art.Name ?? item.Name ?? "" : art.Name ?? item.Name ?? "",
    logoUri: legibleLogoOf(client, art),
    backdropUri: backdropUriOf(client, art) ?? backdropUriOf(client, item),
    meta,
    synopsis: (isEpisode ? item.Overview ?? art.Overview : art.Overview ?? item.Overview) ?? undefined,
    palette: paletteOfItem(art, isEpisode ? null : item),
    primary: {
      label: progress !== undefined ? t("common:resume") : t("common:play"),
      icon: "play",
      progress,
      focusKey: "hero:primary",
    },
    secondary: { label: t("common:moreInfo"), icon: "info", focusKey: "hero:secondary" },
    listToggle: { label: t("common:myList"), active: inWatchlist, focusKey: "hero:list" },
    page,
  };
}
