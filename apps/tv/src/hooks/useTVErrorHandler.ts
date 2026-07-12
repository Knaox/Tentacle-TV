import { useCallback, useRef } from "react";
import { useTVDirectStreamRecovery } from "./useTVDirectStreamRecovery";

/**
 * Gestion d'erreur du lecteur : une erreur de CODEC en direct play bascule en
 * transcode forcé (en reprenant à la position courante, via captureReloadTicks)
 * plutôt que de surfacer l'erreur ; un 401/403 de stream en DIRECT STREAMING
 * redemande un token frais et recharge (useTVDirectStreamRecovery) ; toute
 * autre erreur (ou un codec déjà en transcode) est surfacée.
 */
export function useTVErrorHandler(args: {
  forceTranscode: boolean;
  captureReloadTicks: () => void;
  setVideoError: (e: string | null) => void;
  setForceTranscode: (on: boolean) => void;
  /** Stall remux (-11866 sur pause longue d'une playlist HLS `event`) : récupère
   *  au lieu de surfacer l'erreur (cf. useTVRemuxStallRecovery). */
  onRemuxStall?: () => void;
  /** État de pause utilisateur : un stall PENDANT une pause est absorbé en lazy
   *  et ne compte pas dans la garde anti-boucle (AVPlayer peut réémettre
   *  l'erreur en continu sur une pause morte). */
  pausedStateRef?: React.MutableRefObject<boolean>;
  /** Récupération 401 direct-streaming : reconstruit l'URL avec un token frais.
   *  Absent (tvOS/local) → aucune récupération, comportement historique. */
  bumpReloadNonce?: () => void;
  setIsLoading?: (v: boolean) => void;
}) {
  const { forceTranscode, captureReloadTicks, setVideoError, setForceTranscode, onRemuxStall, pausedStateRef, bumpReloadNonce, setIsLoading } = args;
  const { tryDirectAuthRecovery } = useTVDirectStreamRecovery({
    captureReloadTicks, bumpReloadNonce, setVideoError, setIsLoading,
  });
  // Garde-fou stall remux : compte les récupérations rapprochées (<8 s) → au-delà
  // de 4 (récup qui ne tient pas), on cesse et on surface l'erreur.
  const stallRef = useRef({ count: 0, last: 0 });

  const handleError = useCallback((error: string) => {
    if (error === "REMUX_STALL") {
      // En pause : récupération différée (lazy) — hors garde anti-boucle.
      if (pausedStateRef?.current) { onRemuxStall?.(); return; }
      const now = Date.now(); const s = stallRef.current;
      s.count = now - s.last < 8000 ? s.count + 1 : 1; s.last = now;
      if (s.count > 4) { setVideoError("Playback Stopped"); return; }
      onRemuxStall?.(); return;
    }
    // 401/403 sur le stream en DIRECT streaming : token Jellyfin mort →
    // redemande d'un token frais + reload en direct (jamais de bascule proxy).
    if (tryDirectAuthRecovery(error)) return;
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
  }, [forceTranscode, captureReloadTicks, onRemuxStall, tryDirectAuthRecovery]); // eslint-disable-line react-hooks/exhaustive-deps

  return { handleError };
}
