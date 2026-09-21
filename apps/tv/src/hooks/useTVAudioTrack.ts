import { useCallback, useState } from "react";
import type { MPVPlayerHandle } from "../components/player/MPVPlayer";

/**
 * État + bascule de la piste audio (Android TV et Apple TV).
 *  - `defaultAudio` : piste audio par défaut du conteneur (IsDefault, sinon 1ʳᵉ).
 *    Calculé par le caller (consommé aussi par le reset de useTVReloadState, qui
 *    tourne AVANT ce hook) et re-exposé ici — source unique, zéro recalcul.
 *  - `handleAudioChange` : bascule NATIVE en direct play — sur Apple TV, le HLS
 *    local de PrismCore expose un vrai groupe de sélection AVPlayer, la langue
 *    change sans recharger — ou reload doux du flux (transcode).
 *
 * `audioIndex` (state) est consommé par useTVStreamUrl (dep de l'URL) → ce hook
 * tourne AVANT le stream. `isDirectPlay`/`mpvTrackMap` (décidés APRÈS, par le
 * serveur + le natif) ne sont lus qu'au CLIC → passés via refs (lecture fraîche
 * à l'appel, comportement identique au handler tardif d'origine).
 */
export function useTVAudioTrack(args: {
  defaultAudio: number;
  isDirectPlayRef: React.MutableRefObject<boolean>;
  mpvTrackMapRef: React.MutableRefObject<Record<number, number>>;
  playerRef: React.RefObject<MPVPlayerHandle | null>;
  positionRef: React.MutableRefObject<number>;
  softReloadRef: React.MutableRefObject<boolean>;
  setReloadFrameSec: (v: number | null) => void;
  setReloadNonce: React.Dispatch<React.SetStateAction<number>>;
  captureReloadTicks: () => void;
}) {
  const {
    defaultAudio, isDirectPlayRef, mpvTrackMapRef, playerRef,
    positionRef, softReloadRef, setReloadFrameSec, setReloadNonce, captureReloadTicks,
  } = args;

  const [audioIndex, setAudioIndex] = useState(0);

  const handleAudioChange = useCallback((newIndex: number) => {
    // Direct play → bascule native instantanée. Transcode → reload doux.
    if (isDirectPlayRef.current) {
      const mpvId = mpvTrackMapRef.current[newIndex];
      if (mpvId != null) playerRef.current?.setAudioTrack(mpvId);
      setAudioIndex(newIndex);
    } else {
      softReloadRef.current = true; setReloadFrameSec(positionRef.current); // re-buffer discret (transcode)
      captureReloadTicks();
      setReloadNonce((n) => n + 1);
      setAudioIndex(newIndex);
    }
  }, [playerRef, captureReloadTicks]); // eslint-disable-line react-hooks/exhaustive-deps

  return { audioIndex, setAudioIndex, defaultAudio, handleAudioChange };
}
