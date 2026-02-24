import { useQuery } from "@tanstack/react-query";
import { useJellyfinClient } from "./useJellyfinClient";
import type { MediaItem, ChapterInfo, SegmentTimestamps } from "@tentacle/shared";
import { TICKS_PER_SECOND } from "@tentacle/shared";

interface IntroSkipperSegments {
  Introduction?: { Start: number; End: number };
  Credits?: { Start: number; End: number };
}

interface MediaSegmentDto {
  Id: string;
  ItemId: string;
  Type: string; // "Intro" | "Outro" | "Commercial" | "Preview" | "Recap"
  StartTicks: number;
  EndTicks: number;
}

interface MediaSegmentsResponse {
  Items: MediaSegmentDto[];
  TotalRecordCount: number;
}

export interface SkipSegments {
  intro: SegmentTimestamps | null;
  credits: SegmentTimestamps | null;
}

/**
 * Detect skip intro/outro segments.
 * Priority order:
 * 1. Jellyfin 10.9+ MediaSegments API (native)
 * 2. IntroSkipper plugin API (community plugin)
 * 3. Chapter markers named "Intro" / "Credits"
 */
export function useIntroSkipper(
  itemId: string | undefined,
  item: MediaItem | undefined
): SkipSegments {
  const client = useJellyfinClient();

  // Try Jellyfin 10.9+ native MediaSegments API
  const { data: segmentsData } = useQuery({
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
    enabled: !!itemId,
    staleTime: Infinity,
    retry: false,
  });

  // Fallback: try IntroSkipper community plugin API
  const { data: pluginData } = useQuery({
    queryKey: ["intro-skipper", itemId],
    queryFn: async () => {
      try {
        return await client.fetch<IntroSkipperSegments>(
          `/Episode/${itemId}/IntroSkipperSegments`
        );
      } catch {
        return null;
      }
    },
    enabled: !!itemId && !segmentsData?.Items?.length && item?.Type === "Episode",
    staleTime: Infinity,
    retry: false,
  });

  // Priority 1: Native MediaSegments
  if (segmentsData?.Items?.length) {
    const intro = segmentsData.Items.find((s) => s.Type === "Intro");
    const outro = segmentsData.Items.find((s) => s.Type === "Outro");
    return {
      intro: intro ? { start: intro.StartTicks / TICKS_PER_SECOND, end: intro.EndTicks / TICKS_PER_SECOND } : null,
      credits: outro ? { start: outro.StartTicks / TICKS_PER_SECOND, end: outro.EndTicks / TICKS_PER_SECOND } : null,
    };
  }

  // Priority 2: IntroSkipper plugin
  if (pluginData?.Introduction || pluginData?.Credits) {
    return {
      intro: pluginData.Introduction
        ? { start: pluginData.Introduction.Start, end: pluginData.Introduction.End }
        : null,
      credits: pluginData.Credits
        ? { start: pluginData.Credits.Start, end: pluginData.Credits.End }
        : null,
    };
  }

  // Priority 3: Chapter markers
  return parseChapters(item?.Chapters);
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
