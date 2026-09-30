import { extractMediaQuality, formatCommunityRating, formatDuration, i18n, type MediaItem } from "@tentacle-tv/shared";
import type { HeroModel } from "../../../src/redesign/hero/HeroBanner";
import type { MetaItem } from "../../../src/redesign/hero/MetaLine";
import type { NavRailProps } from "../../../src/redesign/nav/NavRail";
import type { BenchData } from "./benchData";
import { benchNav } from "./navModels";
import { paletteOf, progressOf } from "./models";

/**
 * Les props communes à plusieurs écrans : la navigation (les vraies
 * bibliothèques du compte), la ligne de métadonnées d'une œuvre, un héros.
 */

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;

export function navOf(data: BenchData, activeKey: string, expanded = false): NavRailProps {
  return benchNav(data, activeKey, { expanded });
}

/** « 2024 · 16+ · 2 h 12 · Thriller, Drame · ★ 7,4 · 4K HDR Atmos VF » */
export function metaOf(item: MediaItem, options: { genres?: number; quality?: boolean } = {}): MetaItem[] {
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
    const q = extractMediaQuality(item);
    if (q.resolution === "4K") meta.push({ badge: "4K", strong: true });
    if (q.isDolbyVision) meta.push({ badge: "Dolby Vision" });
    else if (q.isHDR) meta.push({ badge: "HDR" });
    if (q.isDolbyAtmos) meta.push({ badge: "Atmos" });
    else if (q.surroundLabel) meta.push({ badge: q.surroundLabel });
    for (const label of q.audioLabels.slice(0, 2)) meta.push({ badge: label.token });
  }
  return meta;
}

/** Le héros d'une œuvre : Lecture (ou Reprendre et sa jauge), Plus d'infos,
 *  Ma liste. */
export function heroOf(data: BenchData, item: MediaItem, kicker?: string, page?: HeroModel["page"]): HeroModel {
  const progress = progressOf(item);
  const series = item.SeriesId ? data.item(item.SeriesId) : undefined;
  const art = series ?? item;
  return {
    id: item.Id,
    kicker,
    title: art.Name ?? "",
    logoUri: data.image(art.Id, "Logo"),
    backdropUri: data.image(art.Id, "Backdrop") ?? data.image(item.Id, "Backdrop"),
    meta: metaOf(art),
    synopsis: art.Overview ?? undefined,
    palette: paletteOf(data, art),
    primary: {
      label: progress !== undefined ? t("common:resume") : t("common:play"),
      icon: "play",
      progress,
      focusKey: "hero:primary",
    },
    secondary: { label: t("common:moreInfo"), icon: "info", focusKey: "hero:secondary" },
    listToggle: {
      label: t("common:myList"),
      active: art.UserData?.Likes === true,
      focusKey: "hero:list",
    },
    page,
  };
}
