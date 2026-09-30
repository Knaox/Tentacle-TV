import { i18n, type MediaItem, type SubtitleCue } from "@tentacle-tv/shared";
import { playerChromeLabels } from "../../../src/redesign/screens/player/playerLabels";
import type {
  EndScreenModel,
  PlayerLabels,
  PlayerMedia,
  PlayerTimeline,
  PlayerTransport,
  UpNextModel,
} from "../../../src/redesign/screens/player/playerTypes";
// Les MÊMES projections que le lecteur Apple TV (`redesignWiring/player`) :
// le banc montre ce que l'app montrera, pas une copie qui divergerait.
import { buildEndScreen, buildPlayerMedia, buildUpNext } from "../../../src/redesignWiring/player/playerChromeModels";
import type { BenchData } from "./benchData";
import { paletteOf, seriesOf } from "./models";

/**
 * Les props de l'habillage du lecteur, tirées de l'instantané par les
 * fonctions du branchement (`redesignWiring/player`). Au banc, la « vidéo »
 * est une image fixe : le fond du film, ou l'image de l'épisode.
 */

export const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;

const TICKS_PER_SECOND = 10_000_000;

export const playerLabels = (): PlayerLabels => playerChromeLabels(t, { back: 10, forward: 30 });

export function byName(data: BenchData, name: string): MediaItem | undefined {
  return Object.values(data.snapshot.items).find((entry) => entry.item.Name === name)?.item;
}

/** Les épisodes d'une saison de l'instantané, dans l'ordre. */
export function seasonEpisodes(data: BenchData, seasonId: string | undefined): MediaItem[] {
  return seasonId ? data.items(data.snapshot.episodes[seasonId]) : [];
}

/** L'épisode d'une série : saison `season` (index dans `seasons`), épisode `index`. */
export function episodeAt(data: BenchData, seriesName: string, season: number, index: number): MediaItem | undefined {
  const series = byName(data, seriesName);
  const seasonId = series ? data.snapshot.seasons[series.Id]?.[season] : undefined;
  return seasonEpisodes(data, seasonId)[index];
}

export function neighbours(data: BenchData, episode: MediaItem): { previous?: MediaItem; next?: MediaItem } {
  const list = seasonEpisodes(data, episode.SeasonId);
  const index = list.findIndex((it) => it.Id === episode.Id);
  return { previous: index > 0 ? list[index - 1] : undefined, next: index >= 0 ? list[index + 1] : undefined };
}

export const durationOf = (item: MediaItem) => (item.RunTimeTicks ?? 0) / TICKS_PER_SECOND;

/** L'image qui tient lieu de vidéo : l'épisode lui-même, sinon le fond. */
export function videoFrameOf(data: BenchData, item: MediaItem): string | undefined {
  if (item.Type === "Episode") return data.image(item.Id, "Primary") ?? (item.SeriesId ? data.image(item.SeriesId, "Backdrop") : undefined);
  return data.image(item.Id, "Backdrop") ?? data.image(item.Id, "Thumb");
}

export function mediaOf(data: BenchData, item: MediaItem): PlayerMedia {
  const art = seriesOf(data, item) ?? item;
  return buildPlayerMedia(
    item,
    { logoUri: data.image(art.Id, "Logo"), backdropUri: data.image(art.Id, "Backdrop") ?? data.image(item.Id, "Backdrop") },
    true,
  );
}

export function timelineOf(item: MediaItem, fraction: number): PlayerTimeline {
  const duration = durationOf(item);
  const position = Math.round(duration * fraction);
  return { position, duration, buffered: Math.min(duration, position + 96) };
}

export function transportOf(data: BenchData, item: MediaItem): PlayerTransport {
  const around = item.Type === "Episode" ? neighbours(data, item) : {};
  return {
    hasPrevious: !!around.previous,
    hasNext: !!around.next,
    hasEpisodes: item.Type === "Episode" && !!item.SeriesId,
    seekBackSeconds: 10,
    seekForwardSeconds: 30,
  };
}

/** La carte « À suivre » d'un épisode ; `remaining` : le décompte (sur 10 s, la durée livrée). */
export function upNextOf(data: BenchData, next: MediaItem, remaining: number | null): UpNextModel {
  return buildUpNext({ next, imageUri: data.image(next.Id, "Primary"), countdownSeconds: remaining, autoPlay: true, nextTotalMs: 10_000, t });
}

export function endScreenOf(data: BenchData, next: MediaItem, remaining: number | null): EndScreenModel {
  const series = seriesOf(data, next);
  return buildEndScreen(upNextOf(data, next, remaining), {
    title: series?.Name ?? next.SeriesName ?? "",
    logoUri: series ? data.image(series.Id, "Logo") : undefined,
    backdropUri: series ? data.image(series.Id, "Backdrop") : undefined,
    palette: paletteOf(data, series ?? next),
  });
}

/** Deux lignes de sous-titres, dont une en italique — le rendu, pas le texte. */
export function subtitleCue(anchor: SubtitleCue["anchor"] = "bottom"): SubtitleCue {
  const en = i18n.language?.startsWith("en");
  return {
    start: 0,
    end: 4,
    anchor,
    lines: [
      [{ text: en ? "We have to leave. Right now." : "Il faut partir. Tout de suite." }],
      [{ text: en ? "The ship won't wait for us." : "Le vaisseau ne nous attendra pas.", italic: true }],
    ],
  };
}

/** Les images d'une scène, à précharger avant la capture. */
export function imageList(...uris: Array<string | undefined | null>): string[] {
  return uris.filter((uri): uri is string => !!uri);
}
