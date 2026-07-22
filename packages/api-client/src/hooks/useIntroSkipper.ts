import { useQuery } from "@tanstack/react-query";
import { useJellyfinClient } from "./useJellyfinClient";
import type { MediaItem, ChapterInfo, SegmentTimestamps } from "@tentacle-tv/shared";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";

// ---------- Response types ----------

/** intro-skipper plugin: GET /Episode/{id}/IntroSkipperSegments (dictionary format) */
export interface PluginSegmentDict {
  [key: string]: { episodeId?: string; start?: number; end?: number; Start?: number; End?: number } | undefined;
}

/** intro-skipper plugin: GET /Episode/{id}/Timestamps (named-properties format) */
export interface PluginTimestamps {
  introduction?: { episodeId?: string; start?: number; end?: number };
  credits?: { episodeId?: string; start?: number; end?: number };
  recap?: { episodeId?: string; start?: number; end?: number };
  preview?: { episodeId?: string; start?: number; end?: number };
  commercial?: { episodeId?: string; start?: number; end?: number };
}

/** Jellyfin 10.9+ native MediaSegments API */
export interface MediaSegmentDto {
  Id: string;
  ItemId: string;
  Type: string; // "Intro" | "Outro" | "Commercial" | "Preview" | "Recap"
  StartTicks: number;
  EndTicks: number;
}

export interface MediaSegmentsResponse {
  Items: MediaSegmentDto[];
  TotalRecordCount: number;
}

/** Payloads BRUTS des trois sources de segments — même forme que le
 *  `segments.json` persisté par le snapshot desktop pour la lecture locale. */
export interface RawSkipSources {
  mediaSegments?: MediaSegmentsResponse | null;
  pluginDict?: PluginSegmentDict | null;
  pluginTs?: PluginTimestamps | null;
}

export interface SkipSegments {
  intro: SegmentTimestamps | null;
  credits: SegmentTimestamps | null;
}

/** Extract start/end from a segment object, handling both camelCase and PascalCase */
function seg(s: { start?: number; end?: number; Start?: number; End?: number } | undefined): SegmentTimestamps | null {
  if (!s) return null;
  const start = s.start ?? s.Start ?? 0;
  const end = s.end ?? s.End ?? 0;
  return end > 0 ? { start, end } : null;
}

/**
 * Normalisation PURE des segments — partagée entre useIntroSkipper (requêtes
 * serveur) et la lecture locale desktop (segments.json du snapshot).
 * Priority order:
 * 1. Jellyfin 10.9+ MediaSegments API (native)
 * 2. intro-skipper plugin — IntroSkipperSegments (dictionary)
 * 3. intro-skipper plugin — Timestamps (named properties)
 * 4. Chapter markers named "Intro" / "Credits"
 */
export function normalizeSkipSegments(raw: RawSkipSources, chapters?: ChapterInfo[]): SkipSegments {
  const native = raw.mediaSegments;
  if (native?.Items?.length) {
    const intro = native.Items.find((s) => s.Type === "Intro");
    const outro = native.Items.find((s) => s.Type === "Outro");
    return {
      intro: intro ? { start: intro.StartTicks / TICKS_PER_SECOND, end: intro.EndTicks / TICKS_PER_SECOND } : null,
      credits: outro ? { start: outro.StartTicks / TICKS_PER_SECOND, end: outro.EndTicks / TICKS_PER_SECOND } : null,
    };
  }

  // Keys can be PascalCase ("Introduction","Credits") or camelCase ("introduction","credits")
  const dict = raw.pluginDict;
  if (dict && Object.values(dict).some((v) => v && ((v.end ?? v.End ?? 0) > 0))) {
    return { intro: seg(dict.Introduction ?? dict.introduction), credits: seg(dict.Credits ?? dict.credits) };
  }

  const ts = raw.pluginTs;
  if (ts && (ts.introduction || ts.credits)) {
    return { intro: seg(ts.introduction), credits: seg(ts.credits) };
  }

  return parseChapters(chapters);
}

/**
 * Detect skip intro/outro segments (voir l'ordre de priorité de
 * normalizeSkipSegments). `options.enabled=false` coupe les trois requêtes
 * (lecture locale desktop : les segments viennent alors du disque).
 */
export function useIntroSkipper(
  itemId: string | undefined,
  item: MediaItem | undefined,
  options?: { enabled?: boolean }
): SkipSegments {
  const client = useJellyfinClient();
  const on = options?.enabled ?? true;

  // Try Jellyfin 10.9+ native MediaSegments API
  const { data: segmentsData, isFetched: segmentsFetched } = useQuery({
    queryKey: ["media-segments", itemId],
    queryFn: async () => {
      try {
        return await client.fetch<MediaSegmentsResponse>(
          `/MediaSegments/${itemId}?includeSegmentTypes=Intro,Outro`
        );
      } catch {
        return null;
      }
    },
    enabled: !!itemId && on,
    staleTime: Infinity,
    retry: false,
  });

  const hasNativeSegments = !!segmentsData?.Items?.length;

  // Fallback 1: intro-skipper plugin — IntroSkipperSegments endpoint (dict format)
  const { data: pluginDict } = useQuery({
    queryKey: ["intro-skipper-segments", itemId],
    queryFn: async () => {
      try {
        return await client.fetch<PluginSegmentDict>(
          `/Episode/${itemId}/IntroSkipperSegments`
        );
      } catch {
        return null;
      }
    },
    enabled: !!itemId && on && segmentsFetched && !hasNativeSegments && item?.Type === "Episode",
    staleTime: Infinity,
    retry: false,
  });

  const hasPluginDict = pluginDict &&
    Object.values(pluginDict).some((v) => v && ((v.end ?? v.End ?? 0) > 0));
  const pluginDictDone = pluginDict !== undefined;

  // Fallback 2: intro-skipper plugin — Timestamps endpoint (named-property format)
  const { data: pluginTs } = useQuery({
    queryKey: ["intro-skipper-timestamps", itemId],
    queryFn: async () => {
      try {
        return await client.fetch<PluginTimestamps>(
          `/Episode/${itemId}/Timestamps`
        );
      } catch {
        return null;
      }
    },
    enabled: !!itemId && on && segmentsFetched && !hasNativeSegments && pluginDictDone && !hasPluginDict && item?.Type === "Episode",
    staleTime: Infinity,
    retry: false,
  });

  return normalizeSkipSegments({ mediaSegments: segmentsData, pluginDict, pluginTs }, item?.Chapters);
}

function parseChapters(chapters: ChapterInfo[] | undefined): SkipSegments {
  if (!chapters || chapters.length < 2) return { intro: null, credits: null };

  let intro: SegmentTimestamps | null = null;
  let credits: SegmentTimestamps | null = null;

  for (let i = 0; i < chapters.length; i++) {
    const name = chapters[i].Name.toLowerCase();
    const startSec = chapters[i].StartPositionTicks / TICKS_PER_SECOND;
    const nextStartSec = i + 1 < chapters.length
      ? chapters[i + 1].StartPositionTicks / TICKS_PER_SECOND
      : null;

    if (!intro && (name.includes("intro") || name.includes("opening")) && nextStartSec) {
      intro = { start: startSec, end: nextStartSec };
    }
    if (name.includes("credit") || name.includes("ending") || name.includes("outro")) {
      credits = { start: startSec, end: nextStartSec ?? startSec + 120 };
    }
  }

  return { intro, credits };
}
