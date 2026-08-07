import { useEffect, type MutableRefObject } from "react";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";

interface Options {
  streams: JfStream[];
  /** L'utilisateur a choisi lui-même sa piste : ne rien écraser. */
  audioOverrideRef: MutableRefObject<boolean>;
  subtitleOverrideRef: MutableRefObject<boolean>;
  /** Les préférences serveur ont pris la main : elles priment sur les défauts. */
  prefsApplied: MutableRefObject<boolean>;
  setAudioIndex: (index: number) => void;
  setSubtitleIndex: (index: number | null) => void;
}

/**
 * Réconcilie les pistes sur les valeurs par défaut du fichier, dès que les
 * `MediaStreams` arrivent — sauf si l'utilisateur ou les préférences serveur
 * ont déjà tranché. Extraction mécanique de useWatchSession (limite 300
 * lignes/fichier), comportement inchangé.
 */
export function useDefaultTracks({
  streams, audioOverrideRef, subtitleOverrideRef, prefsApplied,
  setAudioIndex, setSubtitleIndex,
}: Options): void {
  useEffect(() => {
    if (streams.length > 0 && !audioOverrideRef.current && !prefsApplied.current) {
      const defAudio = streams.find((s) => s.Type === "Audio" && s.IsDefault)?.Index
        ?? streams.find((s) => s.Type === "Audio")?.Index ?? 0;
      setAudioIndex(defAudio);
    }
  }, [streams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (streams.length > 0 && !prefsApplied.current && !subtitleOverrideRef.current) {
      const defSub = streams.find((s) => s.Type === "Subtitle" && s.IsDefault)?.Index ?? null;
      if (defSub != null) setSubtitleIndex(defSub);
    }
  }, [streams]); // eslint-disable-line react-hooks/exhaustive-deps
}
