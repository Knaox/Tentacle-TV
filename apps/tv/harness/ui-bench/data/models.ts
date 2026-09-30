import {
  formatEpisodeCode,
  i18n,
  resolveBannerImage,
  resolveCardMarkers,
  resolvePosterImage,
  type MediaItem,
} from "@tentacle-tv/shared";
import type { CardModel } from "../../../src/redesign/cards/cardTypes";
import { NEUTRAL_PALETTE, paletteFromBlurHash, type ArtworkPalette } from "../../../src/redesign/color/artworkPalette";
import type { BenchData } from "./benchData";

/**
 * Ce que fera l'intégration, en petit : tirer les props des vues des objets
 * Jellyfin de l'instantané, avec les MÊMES fonctions partagées que l'app
 * (`resolveCardMarkers`, `resolveBannerImage`, `resolvePosterImage`,
 * `formatEpisodeCode`). Les vues ne voient que le résultat.
 */

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;

const TICKS_PER_MINUTE = 60 * 10_000_000;

/** La série d'un épisode (sa note, ses images), quand l'instantané l'a. */
export function seriesOf(data: BenchData, item: MediaItem): MediaItem | undefined {
  return item.SeriesId ? data.item(item.SeriesId) : undefined;
}

function firstHash(hashes: Record<string, string> | undefined): string | undefined {
  return hashes ? Object.values(hashes)[0] : undefined;
}

/** La lumière d'une œuvre : son fond, sinon son affiche, sinon celle de sa série. */
export function paletteOf(data: BenchData, item: MediaItem): ArtworkPalette {
  const blur = (it: MediaItem | undefined) => {
    const hashes = (it as { ImageBlurHashes?: Record<string, Record<string, string>> } | undefined)?.ImageBlurHashes;
    return firstHash(hashes?.Backdrop) ?? firstHash(hashes?.Primary) ?? firstHash(hashes?.Thumb);
  };
  return paletteFromBlurHash(blur(item) ?? blur(seriesOf(data, item))) ?? NEUTRAL_PALETTE;
}

/** 0 à 1, ou undefined s'il n'y a rien à reprendre. */
export function progressOf(item: MediaItem): number | undefined {
  const pct = item.UserData?.PlayedPercentage ?? 0;
  return item.UserData?.Played || pct <= 0 ? undefined : pct / 100;
}

export function remainingLabel(item: MediaItem): string | undefined {
  const pct = item.UserData?.PlayedPercentage ?? 0;
  if (!item.RunTimeTicks || pct <= 0) return undefined;
  const minutes = Math.max(1, Math.round((item.RunTimeTicks * (1 - pct / 100)) / TICKS_PER_MINUTE));
  return t("media:detailRemainingMinutes", { count: minutes });
}

export function episodeLabel(item: MediaItem, withName = false): string {
  const code = formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber);
  return withName && item.Name ? `${code} · ${item.Name}` : code;
}

/** L'image 16:9 d'une carte : Thumb si l'œuvre en a (il porte son titre),
 *  sinon Backdrop — et alors le logo se pose dessus. */
function landscapeOf(data: BenchData, item: MediaItem): { uri?: string; logoUri?: string } {
  if (item.Type === "Episode") {
    const banner = resolveBannerImage(item);
    const uri = banner ? data.image(banner.id, banner.type) : undefined;
    return { uri: uri ?? (item.SeriesId ? data.image(item.SeriesId, "Thumb") ?? data.image(item.SeriesId, "Backdrop") : undefined) };
  }
  const thumb = data.image(item.Id, "Thumb");
  if (thumb) return { uri: thumb };
  return { uri: data.image(item.Id, "Backdrop"), logoUri: data.image(item.Id, "Logo") };
}

export function cardOf(data: BenchData, item: MediaItem, subtitle?: string): CardModel {
  const series = seriesOf(data, item);
  const poster = resolvePosterImage(item, "series");
  const landscape = landscapeOf(data, item);
  const rating = item.Type === "Episode" ? series?.CommunityRating : item.CommunityRating;
  return {
    id: item.Id,
    title: item.Type === "Episode" ? item.SeriesName ?? item.Name ?? "" : item.Name ?? "",
    subtitle,
    landscapeUri: landscape.uri,
    logoUri: landscape.logoUri,
    posterUri: poster ? data.image(poster.id, "Primary") : undefined,
    markers: resolveCardMarkers({
      item,
      communityRating: rating ?? null,
      userScore: data.snapshot.ratings[item.Id] ?? null,
    }),
    progress: progressOf(item),
    palette: paletteOf(data, item),
  };
}

/** Légende d'une carte « Reprendre » : où on en est, et ce qu'il reste. */
export function resumeSubtitle(item: MediaItem): string {
  const remaining = remainingLabel(item);
  const where = item.Type === "Episode" ? episodeLabel(item) : String(item.ProductionYear ?? "");
  return [where, remaining].filter(Boolean).join(" — ");
}

export const yearOf = (item: MediaItem) => (item.ProductionYear ? String(item.ProductionYear) : undefined);
