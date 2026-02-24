import { useQuery } from "@tanstack/react-query";
import { useJellyfinClient } from "./useJellyfinClient";
import type { MediaItem, ChapterInfo, SegmentTimestamps } from "@tentacle/shared";
import { TICKS_PER_SECOND } from "@tentacle/shared";

interface IntroSkipperSegments {
  Introduction?: { Start: number; End: number };
  Credits?: { Start: number; End: number };
}

export interface SkipSegments {
  intro: SegmentTimestamps | null;
  credits: SegmentTimestamps | null;
}

/**
 * Detect skip intro/outro segments.
 * 1. Try IntroSkipper plugin API (if installed)
 * 2. Fallback to chapter markers named "Intro" / "Credits"
 */
export function useIntroSkipper(
  itemId: string | undefined,
  item: MediaItem | undefined
): SkipSegments {
  const client = useJellyfinClient();

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
    enabled: !!itemId && item?.Type === "Episode",
    staleTime: Infinity,
    retry: false,
  });

  // Plugin data takes priority
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

  // Fallback: parse chapter names
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
