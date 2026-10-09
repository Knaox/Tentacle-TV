import { useCallback, type MutableRefObject } from "react";
import type { MediaStream as JfStream, QualityKey } from "@tentacle-tv/shared";
import { BURN_IN_SUBTITLE_CODECS } from "./useWatchSession";

/**
 * Les changements de piste et de qualité du lecteur de bureau — extraits de
 * `WatchDesktop` (limite de 300 lignes par fichier), logique inchangée : en
 * transcodage, l'ancien ffmpeg est tué et la position reprise avant que l'URL
 * ne soit reconstruite.
 */
interface Options {
  qualityKey: QualityKey;
  isDirectPlay: boolean;
  streams: JfStream[];
  burnInSubtitleIndex: number | undefined;
  killTranscode: () => Promise<unknown>;
  getPositionTicks: () => number;
  setStartTicks: (ticks: number) => void;
  setAudioIndex: (index: number) => void;
  setSubtitleIndex: (index: number | null) => void;
  setBurnInSubtitleIndex: (index: number | undefined) => void;
  setQualityKey: (key: QualityKey) => void;
  audioOverrideRef: MutableRefObject<boolean>;
  subtitleOverrideRef: MutableRefObject<boolean>;
}

export function useDesktopTrackHandlers({
  qualityKey, isDirectPlay, streams, burnInSubtitleIndex, killTranscode, getPositionTicks,
  setStartTicks, setAudioIndex, setSubtitleIndex, setBurnInSubtitleIndex, setQualityKey,
  audioOverrideRef, subtitleOverrideRef,
}: Options) {
  const handleAudioChange = useCallback(async (idx: number) => {
    audioOverrideRef.current = true;
    // In transcode mode (quality override), kill old ffmpeg before URL rebuild
    if (qualityKey !== "original") {
      await killTranscode();
      const ticks = getPositionTicks();
      if (ticks > 0) setStartTicks(ticks);
    }
    setAudioIndex(idx);
  }, [qualityKey, killTranscode, getPositionTicks, setStartTicks, setAudioIndex, audioOverrideRef]);

  const handleSubtitleChange = useCallback(async (idx: number | null) => {
    subtitleOverrideRef.current = true;
    // In direct play, mpv handles all subtitle types natively — just update state
    if (isDirectPlay) { setSubtitleIndex(idx); return; }
    // In transcode mode, bitmap subtitles need server burn-in
    if (idx != null) {
      const sub = streams.find((s: JfStream) => s.Type === "Subtitle" && s.Index === idx);
      if (BURN_IN_SUBTITLE_CODECS.test(sub?.Codec ?? "")) {
        await killTranscode();
        const ticks = getPositionTicks();
        if (ticks > 0) setStartTicks(ticks);
        setBurnInSubtitleIndex(idx);
        setSubtitleIndex(idx);
        return;
      }
    }
    if (burnInSubtitleIndex != null) {
      await killTranscode();
      const ticks = getPositionTicks();
      if (ticks > 0) setStartTicks(ticks);
      setBurnInSubtitleIndex(undefined);
    }
    setSubtitleIndex(idx);
  }, [isDirectPlay, streams, killTranscode, getPositionTicks, burnInSubtitleIndex, setStartTicks, setBurnInSubtitleIndex, setSubtitleIndex, subtitleOverrideRef]);

  const handleQualityChange = useCallback(async (key: QualityKey) => {
    await killTranscode();
    const ticks = getPositionTicks();
    if (ticks > 0) setStartTicks(ticks);
    setQualityKey(key);
  }, [killTranscode, getPositionTicks, setQualityKey, setStartTicks]);

  return { handleAudioChange, handleSubtitleChange, handleQualityChange };
}
