import { useCallback } from "react";
import type { MutableRefObject } from "react";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import type { MediaStream as JfStream, QualityKey, QualityPreset } from "@tentacle-tv/shared";
import type { PlayerEngineKind } from "@/player/engine/types";
import { isBitmapSub, type PlaybackFetchOptions } from "./usePlaybackInfoFetch";
import type { PlaybackState } from "./usePlayerPlayback";
import type { usePlayerQuality } from "./usePlayerQuality";

interface Options {
  state: PlaybackState;
  streams: JfStream[];
  quality: ReturnType<typeof usePlayerQuality>;
  positionRef: MutableRefObject<number>;
  fetchPlaybackInfo: (opts?: PlaybackFetchOptions) => Promise<void>;
  audioIndexRef: MutableRefObject<number>;
  subtitleIndexRef: MutableRefObject<number>;
  setAudioIndex: (index: number) => void;
  setSubtitleIndex: (index: number) => void;
  /** Une relance explicite commence : le lecteur avancé doit recharger même une URL identique. */
  onRetry: () => void;
}

/**
 * Les commandes de la session de lecture : changer de piste, de palier,
 * relancer. Extraites de `usePlayerPlayback` (limite de 300 lignes). La règle
 * qui compte : en lecture directe, une piste se change DANS le moteur, jamais
 * par une nouvelle négociation — aucun ffmpeg ne doit naître d'un changement
 * de piste. Le serveur n'est resollicité que quand il travaille déjà
 * (transcodage) ou quand seul lui peut rendre le sous-titre (image gravée,
 * lecteur système).
 */
export function usePlaybackControls({
  state, streams, quality, positionRef, fetchPlaybackInfo,
  audioIndexRef, subtitleIndexRef, setAudioIndex, setSubtitleIndex, onRetry,
}: Options) {
  const startTicks = (): number | undefined => {
    const ticks = Math.floor(positionRef.current * TICKS_PER_SECOND);
    return ticks > 0 ? ticks : undefined;
  };

  /**
   * Lecture directe : la piste change dans le moteur. Transcodage : le serveur
   * la choisit. Tant que la PREMIÈRE négociation n'a pas répondu (préférences
   * de langue arrivées pendant le PlaybackInfo initial, fréquent à froid), on
   * ne renégocie pas : `fetchPlaybackInfo` relit les index à sa réponse et ne
   * repart que si le flux est transcodé — sinon le moteur applique la piste.
   */
  const changeAudio = useCallback((newIndex: number) => {
    audioIndexRef.current = newIndex;
    setAudioIndex(newIndex);
    if (state.isDirectPlay || state.streamUrl === null) return;
    fetchPlaybackInfo({ audioStreamIndex: newIndex, startTimeTicks: startTicks() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPlaybackInfo, state.isDirectPlay, state.streamUrl]);

  /**
   * Lecteur avancé en direct : tout sous-titre, image comprise, se rend dans
   * mpv. Lecteur système : bascule locale, sauf une image à graver (ou à
   * cesser de graver), qui exige le serveur.
   */
  const changeSubtitle = useCallback((newIndex: number) => {
    subtitleIndexRef.current = newIndex;
    setSubtitleIndex(newIndex);
    if (state.streamUrl === null) return;
    if (state.engine === "mpv" && state.isDirectPlay) return;
    const sub = streams.find((s) => s.Index === newIndex && s.Type === "Subtitle");
    const needsBurnIn = sub ? isBitmapSub(sub) : false;
    if (needsBurnIn || (newIndex < 0 && state.burnInSubIndex >= 0)) {
      fetchPlaybackInfo({
        subtitleStreamIndex: newIndex >= 0 ? newIndex : undefined,
        startTimeTicks: startTicks(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPlaybackInfo, streams, state.engine, state.isDirectPlay, state.burnInSubIndex, state.streamUrl]);

  const changeQuality = useCallback((key: QualityKey) => {
    // Choix du menu : désarme le cap auto pour cet item, puis applique.
    const preset = quality.selectQualityManual(key);
    fetchPlaybackInfo({
      maxBitrate: preset.bitrate ?? 0,
      maxWidth: preset.width ?? 0,
      maxHeight: preset.height ?? 0,
      startTimeTicks: startTicks(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPlaybackInfo, quality]);

  /**
   * Relance sans lecture directe (transcodage). `engine` : le moteur pour
   * lequel négocier — l'écran vise le lecteur système, un flux HLS h264/aac se
   * lit partout et c'est souvent le lecteur avancé qui vient d'échouer.
   */
  const retry = useCallback((opts?: { engine?: PlayerEngineKind }) => {
    onRetry();
    // Déjà en transcodage : retirer les DirectPlayProfiles (isRetry) ne change
    // RIEN à la négociation — Jellyfin resservirait le même encodage. Pour que
    // la relance soit réellement différente, on descend d'un palier de
    // qualité : un débit plafonné force une nouvelle session d'encodage.
    // Le palier choisi est affiché (clé effective) — pas de qualité mentie.
    let degraded: QualityPreset | undefined;
    if (!state.isDirectPlay && state.streamUrl) {
      degraded = quality.degradeOneTier();
    }
    fetchPlaybackInfo({
      isRetry: true,
      engine: opts?.engine,
      ...(degraded
        ? { maxBitrate: degraded.bitrate ?? 0, maxWidth: degraded.width ?? 0, maxHeight: degraded.height ?? 0 }
        : {}),
      startTimeTicks: startTicks(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPlaybackInfo, state.isDirectPlay, state.streamUrl, quality, onRetry]);

  return { changeAudio, changeSubtitle, changeQuality, retry };
}
