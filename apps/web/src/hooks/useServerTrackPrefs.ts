/**
 * Résolution EN LIGNE des préférences de pistes : le backend Tentacle choisit
 * l'audio et le sous-titre (alias de langues, variantes VFF/VFQ, heuristique
 * des pistes forcées) à partir des MediaStreams Jellyfin.
 *
 * Extraction mécanique de useWatchSession (limite de 300 lignes par fichier) —
 * comportement inchangé. Hors ligne, c'est useLocalPlaybackTracks qui applique
 * les préférences depuis le cache local.
 */

import { useEffect, type MutableRefObject } from "react";
import { useResolveMediaTracks } from "@tentacle-tv/api-client";
import type { MediaItem, MediaStream as JfStream } from "@tentacle-tv/shared";
import { BURN_IN_SUBTITLE_CODECS } from "@tentacle-tv/shared";

interface Options {
  item: MediaItem | undefined;
  streams: JfStream[];
  ancestors: { Id: string }[] | undefined;
  isDesktop: boolean;
  quality: number | null;
  defaultAudio: number;
  supportsNativeAudioTracks: boolean;
  checkAudioTranscode?: (codec: string, channels: number) => boolean;
  prefsApplied: MutableRefObject<boolean>;
  resumeApplied: MutableRefObject<boolean>;
  audioOverrideRef: MutableRefObject<boolean>;
  subtitleOverrideRef: MutableRefObject<boolean>;
  setAudioIndex: (index: number) => void;
  setSubtitleIndex: (index: number | null) => void;
  setBurnInSubtitleIndex: (index: number | undefined) => void;
  setStartTicks: (ticks: number) => void;
  setPrefsReady: (ready: boolean) => void;
}

export function useServerTrackPrefs({
  item, streams, ancestors, isDesktop, quality, defaultAudio,
  supportsNativeAudioTracks, checkAudioTranscode,
  prefsApplied, resumeApplied, audioOverrideRef, subtitleOverrideRef,
  setAudioIndex, setSubtitleIndex, setBurnInSubtitleIndex, setStartTicks, setPrefsReady,
}: Options): void {
  const resolveTracks = useResolveMediaTracks();
  useEffect(() => {
    if (prefsApplied.current || streams.length === 0 || !item) return;
    if ((item.Type === "Episode" || item.Type === "Season") && ancestors === undefined) return;
    const parentId = item.ParentId;
    const seriesId = item.SeriesId;
    const ancestorIds = (ancestors ?? []).map((a) => a.Id);
    const allCandidates = [...new Set([parentId, seriesId, ...ancestorIds].filter(Boolean))] as string[];
    if (allCandidates.length === 0) { setPrefsReady(true); return; }
    prefsApplied.current = true;
    const aTracks = streams.filter((s) => s.Type === "Audio")
      .map((s) => ({ index: s.Index, language: s.Language, isDefault: s.IsDefault, title: [s.Title, s.DisplayTitle].filter(Boolean).join(" ") }));
    const sTracks = streams.filter((s) => s.Type === "Subtitle")
      .map((s) => ({ index: s.Index, language: s.Language, isForced: s.IsForced, title: [s.Title, s.DisplayTitle].filter(Boolean).join(" ") }));
    resolveTracks.mutate({ libraryId: allCandidates[0], libraryIds: allCandidates, audioTracks: aTracks, subtitleTracks: sTracks }, {
      onSuccess: (result) => {
        if (result.audioIndex != null && !audioOverrideRef.current) {
          if (isDesktop) {
            // Desktop: check if new audio changes direct play status
            const newStream = streams.find((s) => s.Type === "Audio" && s.Index === result.audioIndex);
            const codec = newStream?.Codec?.toLowerCase() ?? "";
            const channels = newStream?.Channels ?? 2;
            const needsXcode = checkAudioTranscode ? checkAudioTranscode(codec, channels) : false;
            const willBeDP = quality == null && !needsXcode
              && (result.audioIndex === defaultAudio || supportsNativeAudioTracks);
            if (!willBeDP) {
              const resumeTicks = item?.UserData?.PlaybackPositionTicks;
              if (resumeTicks && resumeTicks > 0) { setStartTicks(resumeTicks); resumeApplied.current = true; }
            }
          }
          // Web: server determines direct play via PlaybackInfo — no client check needed
          setAudioIndex(result.audioIndex);
        }
        if (result.subtitleIndex != null && !subtitleOverrideRef.current) {
          const idx = result.subtitleIndex === -1 ? null : result.subtitleIndex;
          setSubtitleIndex(idx);
          if (idx != null) {
            const sub = streams.find((s) => s.Type === "Subtitle" && s.Index === idx);
            if (sub && BURN_IN_SUBTITLE_CODECS.test(sub.Codec ?? "")) setBurnInSubtitleIndex(idx);
          }
        }
        setPrefsReady(true);
      },
      onError: () => setPrefsReady(true),
    });
  }, [streams, item, ancestors]); // eslint-disable-line react-hooks/exhaustive-deps
}
