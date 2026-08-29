/**
 * Résolution EN LIGNE des préférences de pistes : le backend Tentacle choisit
 * l'audio et le sous-titre (alias de langues, variantes VFF/VFQ, heuristique
 * des pistes forcées) à partir des MediaStreams Jellyfin.
 *
 * Extraction mécanique de useWatchSession (limite de 300 lignes par fichier) —
 * comportement inchangé. En LECTURE LOCALE (fichier téléchargé, en ligne comme
 * hors ligne), aucune requête : c'est useLocalPlaybackTracks qui applique les
 * préférences depuis le cache local — zéro bande passante.
 */

import { useEffect, useRef, type MutableRefObject } from "react";
import { useResolveMediaTracks } from "@tentacle-tv/api-client";
import type { MediaItem, MediaStream as JfStream } from "@tentacle-tv/shared";
import { needsBurnIn } from "./useWebPlaybackFallbacks";

interface Options {
  item: MediaItem | undefined;
  streams: JfStream[];
  ancestors: { Id: string }[] | undefined;
  isDesktop: boolean;
  /** Lecture d'un fichier téléchargé : résolution locale, aucun POST /resolve. */
  isLocalPlayback: boolean;
  quality: number | null;
  defaultAudio: number;
  supportsNativeAudioTracks: boolean;
  checkAudioTranscode?: (codec: string, channels: number) => boolean;
  /** Le rendu PGS client est disponible : pas d'incrustation serveur à prévoir. */
  pgsClientOk: boolean;
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
  item, streams, ancestors, isDesktop, isLocalPlayback, quality, defaultAudio,
  supportsNativeAudioTracks, checkAudioTranscode, pgsClientOk,
  prefsApplied, resumeApplied, audioOverrideRef, subtitleOverrideRef,
  setAudioIndex, setSubtitleIndex, setBurnInSubtitleIndex, setStartTicks, setPrefsReady,
}: Options): void {
  const resolveTracks = useResolveMediaTracks();
  // « La requête est partie », à distinguer de « les préférences sont
  // appliquées ». Les deux étaient confondues dans `prefsApplied`, et un
  // /resolve en échec laissait donc le client croire que ses préférences
  // avaient été honorées : la garde du démarrage tombait, et un écart
  // transitoire de piste audio suffisait à forcer un transcodage. Porte
  // l'identifiant du média, donc se réarme tout seul au changement d'épisode.
  const requestSent = useRef<string | null>(null);
  useEffect(() => {
    if (streams.length === 0 || !item) return;
    if (requestSent.current === item.Id || prefsApplied.current) return;
    if (isLocalPlayback) {
      // Lecture locale : useLocalPlaybackTracks applique les préférences
      // depuis le cache — ce chemin serveur est neutralisé (zéro réseau).
      prefsApplied.current = true;
      setPrefsReady(true);
      return;
    }
    if ((item.Type === "Episode" || item.Type === "Season") && ancestors === undefined) return;
    const parentId = item.ParentId;
    const seriesId = item.SeriesId;
    const ancestorIds = (ancestors ?? []).map((a) => a.Id);
    const allCandidates = [...new Set([parentId, seriesId, ...ancestorIds].filter(Boolean))] as string[];
    if (allCandidates.length === 0) { setPrefsReady(true); return; }
    requestSent.current = item.Id;
    const aTracks = streams.filter((s) => s.Type === "Audio")
      .map((s) => ({ index: s.Index, language: s.Language, isDefault: s.IsDefault, title: [s.Title, s.DisplayTitle].filter(Boolean).join(" ") }));
    const sTracks = streams.filter((s) => s.Type === "Subtitle")
      .map((s) => ({ index: s.Index, language: s.Language, isForced: s.IsForced, title: [s.Title, s.DisplayTitle].filter(Boolean).join(" ") }));
    // `itemId` en premier : le backend s'arrête au premier niveau trouvé, donc le
    // choix fait la dernière fois qu'on a regardé CE contenu bat la saison, la
    // série et la bibliothèque (cf. `preferences.resolve.ts`).
    resolveTracks.mutate({ libraryId: allCandidates[0], libraryIds: allCandidates, itemId: item.Id, audioTracks: aTracks, subtitleTracks: sTracks }, {
      onSuccess: (result) => {
        // Ici seulement : les préférences ont vraiment été résolues.
        prefsApplied.current = true;
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
            // Un PGS rendu côté client n'a pas à être incrusté : l'incrustation
            // coûterait un ré-encodage complet de l'image, dès le démarrage.
            if (sub && needsBurnIn(sub.Codec, pgsClientOk)) setBurnInSubtitleIndex(idx);
          }
        }
        setPrefsReady(true);
      },
      onError: () => setPrefsReady(true),
    });
  }, [streams, item, ancestors, isLocalPlayback]); // eslint-disable-line react-hooks/exhaustive-deps
}
