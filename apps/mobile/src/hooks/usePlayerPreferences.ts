import { useEffect, useRef } from "react";
import { useResolveMediaTracks } from "@tentacle-tv/api-client";
import type { MediaStream as JfStream, MediaItem } from "@tentacle-tv/shared";

interface PreferencesOptions {
  item: MediaItem | undefined;
  ancestors: Array<{ Id: string; Name: string; Type: string }> | undefined;
  streams: JfStream[];
  onAudioResolved: (index: number) => void;
  onSubtitleResolved: (index: number) => void;
}

/**
 * Auto-applies language preferences (audio + subtitle) when a media item loads.
 * Uses the backend /api/preferences/resolve endpoint to match user preferences
 * per library with available tracks.
 */
export function usePlayerPreferences({
  item, ancestors, streams, onAudioResolved, onSubtitleResolved,
}: PreferencesOptions) {
  const applied = useRef(false);
  const resolveTracks = useResolveMediaTracks();

  useEffect(() => {
    if (applied.current || streams.length === 0 || !item || !ancestors) return;
    const parentId = item.ParentId;
    const seriesId = item.SeriesId;
    const ancestorIds = ancestors.map((a) => a.Id);
    const allCandidates = [...new Set(
      [parentId, seriesId, ...ancestorIds].filter(Boolean),
    )] as string[];
    if (allCandidates.length === 0) return;

    applied.current = true;
    resolveTracks.mutate({
      libraryId: allCandidates[0],
      libraryIds: allCandidates,
      audioTracks: streams
        .filter((s) => s.Type === "Audio")
        .map((s) => ({ index: s.Index, language: s.Language, isDefault: s.IsDefault })),
      subtitleTracks: streams
        .filter((s) => s.Type === "Subtitle")
        .map((s) => ({ index: s.Index, language: s.Language, isForced: s.IsForced, title: s.DisplayTitle })),
    }, {
      onSuccess: (result) => {
        if (result.audioIndex != null) onAudioResolved(result.audioIndex);
        if (result.subtitleIndex != null) onSubtitleResolved(result.subtitleIndex);
      },
    });
  }, [streams, item, ancestors]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Reset applied flag (call on episode change) */
  const reset = () => { applied.current = false; };

  return { reset };
}
