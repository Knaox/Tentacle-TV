import { useCallback } from "react";
import { useTVDirectStreamRecovery } from "./useTVDirectStreamRecovery";
import { plog } from "../utils/playerDiag";

/**
 * Gestion d'erreur du lecteur : une erreur de CODEC en direct play bascule en
 * transcode forcé (en reprenant à la position courante, via captureReloadTicks)
 * plutôt que de surfacer l'erreur ; un 401/403 de stream en DIRECT STREAMING
 * redemande un token frais et recharge (useTVDirectStreamRecovery) ; un master
 * PrismCore refusé par AVPlayer se rejoue en forme muxée (onMasterRejected) ;
 * toute autre erreur (ou un codec déjà en transcode) est surfacée.
 */
export function useTVErrorHandler(args: {
  forceTranscode: boolean;
  captureReloadTicks: () => void;
  setVideoError: (e: string | null) => void;
  setForceTranscode: (on: boolean) => void;
  /** Récupération 401 direct-streaming : reconstruit l'URL avec un token frais.
   *  Absent (tvOS/local) → aucune récupération, comportement historique. */
  bumpReloadNonce?: () => void;
  setIsLoading?: (v: boolean) => void;
  /** tvOS/PrismCore : AVPlayer a refusé le master (`PRISM_MASTER_REJECTED`). */
  onMasterRejected?: () => void;
}) {
  const { forceTranscode, captureReloadTicks, setVideoError, setForceTranscode, bumpReloadNonce, setIsLoading, onMasterRejected } = args;
  const { tryDirectAuthRecovery } = useTVDirectStreamRecovery({
    captureReloadTicks, bumpReloadNonce, setVideoError, setIsLoading,
  });

  const handleError = useCallback((error: string) => {
    if (error === "PRISM_MASTER_REJECTED") {
      plog("err", "master PrismCore refusé par AVPlayer → forme muxée");
      if (onMasterRejected) { onMasterRejected(); return; }
      // Sans rejeu possible : transcode serveur à la position courante.
      captureReloadTicks();
      setForceTranscode(true);
      return;
    }
    // 401/403 sur le stream en DIRECT streaming : token Jellyfin mort →
    // redemande d'un token frais + reload en direct (jamais de bascule proxy).
    if (tryDirectAuthRecovery(error)) { plog("err", "401/403 direct → refresh token + reload"); return; }
    const isCodecError = error.includes("DECODING_FAILED") || error.includes("EXCEEDS_CAPABILITIES")
      || error.includes("codec") || error.includes("Could not open");
    if (isCodecError && !forceTranscode) {
      // Bascule transcode en cours de lecture : reprendre à la position
      // courante (avant : repartait à zéro).
      plog("err", `erreur codec → bascule transcode forcé (${error})`);
      captureReloadTicks();
      setVideoError(null);
      setForceTranscode(true);
      return;
    }
    plog("err", `erreur SURFACÉE à l'écran : ${error}`);
    setVideoError(error);
  }, [forceTranscode, captureReloadTicks, tryDirectAuthRecovery, onMasterRejected]); // eslint-disable-line react-hooks/exhaustive-deps

  return { handleError };
}
