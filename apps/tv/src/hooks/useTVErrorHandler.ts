import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { isAudioTransientError } from "@tentacle-tv/tv-core";
import { useAudioErrorRetry } from "./useAudioErrorRetry";
import { useTVDirectStreamRecovery } from "./useTVDirectStreamRecovery";
import { isFormatError, usePlaybackRecovery, type RecoverySources } from "./usePlaybackRecovery";
import { plog } from "../utils/playerDiag";

/**
 * Gestion d'erreur du lecteur : une erreur de CODEC en direct play bascule en
 * transcode forcé (en reprenant à la position courante, via captureReloadTicks)
 * plutôt que de surfacer l'erreur ; un 401/403 de stream en DIRECT STREAMING
 * redemande un token frais et recharge (useTVDirectStreamRecovery) ; un master
 * PrismCore refusé par AVPlayer se rejoue en forme muxée (onMasterRejected) ;
 * toute autre erreur (ou un codec déjà en transcode) est surfacée.
 *
 * AVANT tout cela, une erreur survenue après le démarrage est confiée à la
 * reprise (`usePlaybackRecovery`, montée ici) : un serveur coupé n'est pas un
 * refus de format — elle attend son retour et relance le flux sous la même
 * forme, au lieu de la forme muxée puis du transcodage forcé.
 *
 * Et avant encore, à l'ouverture comme en lecture, une sortie AUDIO
 * passagèrement indisponible (`useAudioErrorRetry`) : rejouée à la même forme
 * après un délai, jamais descendue ; dite si elle ne revient pas.
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
  /** Ce que la reprise lit du lecteur (état média et pipeline de flux). */
  recovery?: RecoverySources;
}) {
  const { forceTranscode, captureReloadTicks, setVideoError, setForceTranscode, bumpReloadNonce, setIsLoading, onMasterRejected } = args;
  const { t } = useTranslation("player");
  const { onSourceLost } = usePlaybackRecovery(args.recovery);
  const onAudioError = useAudioErrorRetry(args.recovery);
  const { tryDirectAuthRecovery } = useTVDirectStreamRecovery({
    captureReloadTicks, bumpReloadNonce, setVideoError, setIsLoading,
  });

  const handleError = useCallback((error: string) => {
    if (isAudioTransientError(error)) {
      if (onAudioError(error)) return;
      // La sortie ne revient pas : le dire — une autre forme ne la rendrait pas.
      plog("err", `sortie audio toujours indisponible → erreur dite (${error.slice(0, 60)})`);
      setIsLoading?.(false);
      setVideoError(t("audioOutputLost"));
      return;
    }
    if (onSourceLost(error)) return;
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
    if (isFormatError(error) && !forceTranscode) {
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
  }, [forceTranscode, captureReloadTicks, tryDirectAuthRecovery, onMasterRejected, onSourceLost, onAudioError, t]); // eslint-disable-line react-hooks/exhaustive-deps

  return { handleError };
}
