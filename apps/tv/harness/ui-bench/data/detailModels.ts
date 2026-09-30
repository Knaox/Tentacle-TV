import {
  extractMediaQuality,
  formatCommunityRating,
  formatDuration,
  formatEpisodeCode,
  getNextEpisode,
  i18n,
  resolveSeasonSelection,
  type MediaItem,
  type NextEpisodeResult,
} from "@tentacle-tv/shared";
import type { MetaItem } from "../../../src/redesign/hero/MetaLine";
import type {
  DetailActionsModel,
  DetailHeaderModel,
  EpisodeBadge,
  EpisodeModel,
  EpisodesModel,
} from "../../../src/redesign/screens/detail/detailTypes";
import type { BenchData } from "./benchData";
import { paletteOf, progressOf, seriesOf } from "./models";

/**
 * La fiche, en petit, comme l'intégration la tirera : l'en-tête et ses
 * actions, l'état de visionnage d'une série (`getNextEpisode`, la règle de
 * `useSeriesWatchState`), la saison à ouvrir (`resolveSeasonSelection`, celle
 * de `useSeasonBrowser`) et les épisodes — avec les fonctions partagées.
 */

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;

/** Les résumés Jellyfin portent parfois du HTML (« <br>Source: crunchyroll »). */
export function plainText(value: string | null | undefined): string | undefined {
  const text = value?.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return text || undefined;
}

/** « 2005 · CH-16 · 2h 08min · Drame, Romance · ★ 8.1 » — les faits, sans la technique. */
export function factsOf(item: MediaItem): MetaItem[] {
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
  const genres = (item.Genres ?? []).slice(0, 2);
  if (genres.length && item.Type !== "Episode") meta.push(genres.join(", "));
  if (item.CommunityRating) meta.push({ rating: formatCommunityRating(item.CommunityRating) });
  return meta;
}

/** « 4K · Dolby Vision · Atmos · VF · EN » — des pastilles de texte, jamais des drapeaux. */
export function badgesOf(item: MediaItem): MetaItem[] {
  const q = extractMediaQuality(item);
  const badges: MetaItem[] = [];
  if (q.resolution === "4K") badges.push({ badge: "4K", strong: true });
  if (q.isDolbyVision) badges.push({ badge: "Dolby Vision" });
  else if (q.isHDR) badges.push({ badge: "HDR" });
  if (q.isDolbyAtmos) badges.push({ badge: "Atmos" });
  else if (q.surroundLabel) badges.push({ badge: q.surroundLabel });
  for (const label of q.audioLabels.slice(0, 3)) badges.push({ badge: label.token });
  return badges;
}

function kindOf(item: MediaItem): DetailHeaderModel["kind"] {
  if (item.Type === "Series") return "series";
  if (item.Type === "Episode") return "episode";
  if (item.Type === "BoxSet") return "collection";
  return "movie";
}

export function headerOf(data: BenchData, item: MediaItem): DetailHeaderModel {
  const userScore = data.snapshot.ratings[item.Id] ?? null;
  if (item.Type === "Episode") {
    const series = seriesOf(data, item);
    const aired = item.PremiereDate ? new Date(item.PremiereDate).toLocaleDateString(i18n.language, { day: "numeric", month: "long", year: "numeric" }) : null;
    return {
      kind: "episode",
      title: item.Name ?? "",
      logoUri: series ? data.image(series.Id, "Logo") : undefined,
      seriesLink: `${item.SeriesName ?? series?.Name ?? ""} — ${formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber)}`,
      meta: [...(aired ? [aired] : []), ...factsOf(item).filter((m) => typeof m !== "string" || !/^\d{4}$/.test(m))],
      badges: badgesOf(item),
      userScore,
      synopsis: plainText(item.Overview),
    };
  }
  return {
    kind: kindOf(item),
    title: item.Name ?? "",
    logoUri: data.image(item.Id, "Logo"),
    meta: factsOf(item),
    badges: badgesOf(item),
    userScore,
    synopsis: plainText(item.Overview),
  };
}

/** L'image plein cadre : le fond de l'œuvre ; pour un épisode, SON image 16:9. */
export function backdropOf(data: BenchData, item: MediaItem): string | undefined {
  if (item.Type === "Episode") return data.image(item.Id, "Primary") ?? (item.SeriesId ? data.image(item.SeriesId, "Backdrop") : undefined);
  return data.image(item.Id, "Backdrop");
}

/** Tous les épisodes connus d'une série, spéciaux exclus, dans l'ordre (la requête de `useSeriesWatchState`). */
function seriesEpisodes(data: BenchData, seriesId: string): MediaItem[] {
  const all: MediaItem[] = [];
  for (const seasonId of data.snapshot.seasons[seriesId] ?? []) all.push(...data.items(data.snapshot.episodes[seasonId]));
  return all
    .filter((episode) => (episode.ParentIndexNumber ?? 0) > 0)
    .sort((a, b) => (a.ParentIndexNumber ?? 0) - (b.ParentIndexNumber ?? 0) || (a.IndexNumber ?? 0) - (b.IndexNumber ?? 0));
}

export function watchStateOf(data: BenchData, seriesId: string): NextEpisodeResult {
  return getNextEpisode(seriesEpisodes(data, seriesId));
}

const TICKS_PER_MINUTE = 60 * 10_000_000;

/** « Reste 12 min », « Reste 2 h 07 min » — sous la pilule « Reprendre ». */
function remainingOf(item: MediaItem): string | undefined {
  const pct = item.UserData?.PlayedPercentage ?? 0;
  if (!item.RunTimeTicks || pct <= 0) return undefined;
  const minutes = Math.max(1, Math.round((item.RunTimeTicks * (1 - pct / 100)) / TICKS_PER_MINUTE));
  if (minutes < 60) return t("media:detailRemainingMinutes", { count: minutes });
  return t("media:detailRemainingHours", { hours: Math.floor(minutes / 60), minutes: String(minutes % 60).padStart(2, "0") });
}

export function actionsOf(data: BenchData, item: MediaItem, watch?: NextEpisodeResult): DetailActionsModel {
  const toggles = {
    watchlist: item.UserData?.Likes === true,
    favorite: item.UserData?.IsFavorite === true,
    watched: item.UserData?.Played === true,
    rating: item.ProviderIds?.Tmdb ? { score: data.snapshot.ratings[item.Id] ?? null } : undefined,
    trailer: false,
  };
  if (item.Type === "BoxSet") return { ...toggles, play: null };
  if (item.Type === "Series") {
    if (!watch || watch.type === "completed") return { ...toggles, play: watch ? null : { label: t("common:play") } };
    const episode = watch.episode;
    const code = formatEpisodeCode(episode.ParentIndexNumber, episode.IndexNumber);
    const resume = watch.type === "continue";
    return {
      ...toggles,
      play: {
        label: `${t(resume ? "common:resume" : "common:play")} ${code}`,
        progress: resume ? progressOf(episode) : undefined,
        caption: resume ? remainingOf(episode) : undefined,
      },
    };
  }
  const progress = progressOf(item);
  return {
    ...toggles,
    play: { label: t(progress !== undefined ? "common:resume" : "common:play"), progress, caption: progress !== undefined ? remainingOf(item) : undefined },
  };
}

export interface EpisodesOptions {
  /** La saison choisie (onglet), ou celle de l'épisode ouvert. */
  seasonId?: string;
  /** Fiche d'épisode : l'épisode ouvert (« Épisode actuel »). */
  currentEpisodeId?: string;
  watch?: NextEpisodeResult;
}

export function episodesOf(data: BenchData, seriesId: string, options: EpisodesOptions = {}): EpisodesModel | null {
  const seasons = data.items(data.snapshot.seasons[seriesId]);
  if (!seasons.length) return null;
  const selection = resolveSeasonSelection({ seasons, preferredSeasonId: options.seasonId, watchState: options.watch, watchPending: false });
  const current = options.currentEpisodeId ? data.item(options.currentEpisodeId) : undefined;
  const marked = selection.currentSeasonId ?? current?.SeasonId;
  const watchEpisode = options.watch && options.watch.type !== "completed" ? options.watch.episode : undefined;
  const highlightId = options.currentEpisodeId ?? watchEpisode?.Id;
  const badgeOf = (episode: MediaItem): EpisodeBadge | null => {
    if (episode.Id !== highlightId) return null;
    if (options.currentEpisodeId) return "current";
    return (episode.UserData?.PlaybackPositionTicks ?? 0) > 0 ? "resume" : "upNext";
  };
  const list = selection.seasonId ? data.items(data.snapshot.episodes[selection.seasonId]) : [];
  const episodes: EpisodeModel[] = list.map((episode) => ({
    id: episode.Id,
    number: episode.IndexNumber ?? undefined,
    title: episode.Name ?? "",
    imageUri: data.image(episode.Id, "Primary"),
    meta: formatDuration(episode.RunTimeTicks) ?? undefined,
    overview: plainText(episode.Overview),
    progress: progressOf(episode),
    watched: episode.UserData?.Played === true,
    badge: badgeOf(episode),
    palette: paletteOf(data, episode),
  }));
  return {
    seasons: seasons.map((season) => ({
      id: season.Id,
      label: season.Name ?? "",
      episodeCount: season.RecursiveItemCount ?? season.ChildCount ?? undefined,
      state: season.Id === marked ? "current" : season.UserData?.Played ? "watched" : null,
    })),
    selectedSeasonId: selection.seasonId,
    episodes,
    anchorIndex: Math.max(0, episodes.findIndex((episode) => episode.id === highlightId)),
  };
}
