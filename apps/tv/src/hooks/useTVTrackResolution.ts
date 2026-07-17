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
  /** Appelé quand la piste audio préférée DIFFÈRE de la piste par défaut →
   *  le caller force un reload du flux (nécessaire en transcode tvOS, où le
   *  changement d'audio n'est pas natif). No-op si la préférence == défaut. */
  onAudioReloadNeeded?: () => void;
}) {
  const { streams, item, ancestors, positionRef, setAudioIndex, setSubtitleIndex, setStartTicks, onAudioReloadNeeded } = args;
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
        // title obligatoire pour matcher une VARIANTE (VFF/VFQ) : le backend la
        // reconnaît uniquement dans le titre de la piste (parité web).
        .map((s) => ({
          index: s.Index, language: s.Language, isDefault: s.IsDefault,
          title: [s.Title, s.DisplayTitle].filter(Boolean).join(" "),
        })),
      subtitleTracks: streams.filter((s) => s.Type === "Subtitle")
        .map((s) => ({ index: s.Index, language: s.Language, isForced: s.IsForced, title: s.DisplayTitle })),
    }, {
      onSuccess: (result) => {
        if (result.audioIndex != null) {
          // Piste audio du flux initial = défaut conteneur (IsDefault, sinon 1ʳᵉ).
          const curDefault = streams.find((s) => s.Type === "Audio" && s.IsDefault)?.Index
            ?? streams.find((s) => s.Type === "Audio")?.Index ?? 0;
          if (positionRef.current > 0) setStartTicks(Math.floor(positionRef.current * TICKS_PER_SECOND));
          setAudioIndex(result.audioIndex);
          // La préférence diffère du défaut → forcer un reload (transcode tvOS,
          // où l'audio n'est pas commutable nativement). Sinon le flux resterait
          // sur l'audio par défaut alors que l'UI affiche la préférence.
          if (result.audioIndex !== curDefault) onAudioReloadNeeded?.();
        }
        if (result.subtitleIndex != null) setSubtitleIndex(result.subtitleIndex);
      },
    });
  }, [streams, item, ancestors]); // eslint-disable-line react-hooks/exhaustive-deps

  return { resetPrefsApplied: () => { prefsApplied.current = false; } };
}
