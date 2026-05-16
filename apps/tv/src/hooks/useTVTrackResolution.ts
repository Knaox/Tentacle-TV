import { useEffect, useRef } from "react";
import { useResolveMediaTracks } from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import type { MediaStream as JfStream, MediaItem } from "@tentacle-tv/shared";

/**
 * Résout les pistes audio / sous-titres préférées via les préférences
 * utilisateur (`useResolveMediaTracks`) en remontant les ancêtres (saison
 * → série → bibliothèque). Met à jour les states et `startTicks` côté caller.
 */
export function useTVTrackResolution(args: {
  streams: JfStream[];
  item?: MediaItem | null;
  ancestors?: { Id: string }[] | undefined;
  positionRef: React.MutableRefObject<number>;
  setAudioIndex: (i: number) => void;
  setSubtitleIndex: (i: number) => void;
  setStartTicks: (t: number) => void;
}) {
  const { streams, item, ancestors, positionRef, setAudioIndex, setSubtitleIndex, setStartTicks } = args;
  const resolveTracks = useResolveMediaTracks();
  const prefsApplied = useRef(false);

  useEffect(() => {
    if (prefsApplied.current || streams.length === 0 || !item || !ancestors) return;
    const ancestorIds = ancestors.map((a) => a.Id);
    const candidates = [...new Set([item.ParentId, item.SeriesId, ...ancestorIds].filter(Boolean))] as string[];
    if (candidates.length === 0) return;
    prefsApplied.current = true;
    resolveTracks.mutate({
      libraryId: candidates[0], libraryIds: candidates,
      audioTracks: streams.filter((s) => s.Type === "Audio")
        .map((s) => ({ index: s.Index, language: s.Language, isDefault: s.IsDefault })),
      subtitleTracks: streams.filter((s) => s.Type === "Subtitle")
        .map((s) => ({ index: s.Index, language: s.Language, isForced: s.IsForced, title: s.DisplayTitle })),
    }, {
      onSuccess: (result) => {
        if (result.audioIndex != null) {
          if (positionRef.current > 0) setStartTicks(Math.floor(positionRef.current * TICKS_PER_SECOND));
          setAudioIndex(result.audioIndex);
        }
        if (result.subtitleIndex != null) setSubtitleIndex(result.subtitleIndex);
      },
    });
  }, [streams, item, ancestors]); // eslint-disable-line react-hooks/exhaustive-deps

  return { resetPrefsApplied: () => { prefsApplied.current = false; } };
}
