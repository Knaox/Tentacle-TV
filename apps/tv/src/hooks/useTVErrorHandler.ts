import { useCallback } from "react";

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
}) {
  const { forceTranscode, captureReloadTicks, setVideoError, setForceTranscode } = args;

  const handleError = useCallback((error: string) => {
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
  }, [forceTranscode, captureReloadTicks]); // eslint-disable-line react-hooks/exhaustive-deps

  return { handleError };
}
