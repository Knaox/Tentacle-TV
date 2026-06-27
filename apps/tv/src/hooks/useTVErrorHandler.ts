import { useCallback, useRef } from "react";

/**
 * Gestion d'erreur du lecteur Apple TV : une erreur de CODEC en direct play
 * bascule en transcode forcé (en reprenant à la position courante, via
 * captureReloadTicks) plutôt que de surfacer l'erreur ; toute autre erreur (ou
 * un codec déjà en transcode) est surfacée. Extrait VERBATIM de PlayerScreen
 * (handleError) — détection, deps et commentaires préservés.
 */
export function useTVErrorHandler(args: {
  forceTranscode: boolean;
  captureReloadTicks: () => void;
  setVideoError: (e: string | null) => void;
  setForceTranscode: (on: boolean) => void;
  /** Stall remux (-11866 sur pause longue d'une playlist HLS `event`) : récupère
   *  au lieu de surfacer l'erreur (recharge + reprend, cf. PlayerScreen). */
  onRemuxStall?: () => void;
}) {
  const { forceTranscode, captureReloadTicks, setVideoError, setForceTranscode, onRemuxStall } = args;
  // Garde-fou stall remux : compte les récupérations rapprochées (<8 s) → au-delà
  // de 4 (récup qui ne tient pas), on cesse et on surface l'erreur.
  const stallRef = useRef({ count: 0, last: 0 });

  const handleError = useCallback((error: string) => {
    if (error === "REMUX_STALL") {
      const now = Date.now(); const s = stallRef.current;
      s.count = now - s.last < 8000 ? s.count + 1 : 1; s.last = now;
      if (s.count > 4) { setVideoError("Playback Stopped"); return; }
      onRemuxStall?.(); return;
    }
    const isCodecError = error.includes("DECODING_FAILED") || error.includes("EXCEEDS_CAPABILITIES")
      || error.includes("codec") || error.includes("Could not open");
    if (isCodecError && !forceTranscode) {
      // Bascule transcode en cours de lecture : reprendre à la position
      // courante (avant : repartait à zéro).
      captureReloadTicks();
      setVideoError(null);
      setForceTranscode(true);
      return;
    }
    setVideoError(error);
  }, [forceTranscode, captureReloadTicks, onRemuxStall]); // eslint-disable-line react-hooks/exhaustive-deps

  return { handleError };
}
