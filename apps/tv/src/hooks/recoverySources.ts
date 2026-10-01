import type { RestartOptions, RestartOutcome } from "./streamRestart";

/**
 * Ce que la reprise d'une lecture (`usePlaybackRecovery`) et ses voisins
 * (`useStartupRecovery`, `useAudioErrorRetry`) lisent du lecteur : le bus
 * d'état (`usePlayerMediaState`) et le pipeline de flux
 * (`usePlayerStreamPipeline`), passés tels quels par l'écran.
 */
export interface RecoverySources {
  s: {
    hasStarted: boolean;
    paused: boolean;
    isLoading: boolean;
    /** Rechargement VOULU en cours (piste, qualité, relance) : pas un arrêt. */
    reloadHold: boolean;
    /** Tient le lecteur en rechargement (indicateur, aucun son de la session sortante). */
    holdForReload: () => void;
    /** L'intention de lecture de l'utilisateur (Lecture / Pause). */
    setPaused: (paused: boolean) => void;
    positionRef: React.MutableRefObject<number>;
    bufferedTimeRef: React.MutableRefObject<number>;
    endedRef: React.MutableRefObject<boolean>;
  };
  p: {
    restartStream: (opts?: RestartOptions) => Promise<RestartOutcome>;
    /** L'ouverture du flux a échoué (écran d'échec, « Réessayer »). */
    failed: boolean;
    /** Relance l'ouverture — le « Réessayer » de l'écran d'échec. */
    setReloadNonce: (next: (n: number) => number) => void;
    /** Où la lecture démarre (reprise ou position posée), timeline absolue. */
    startSeconds: number;
    /** Lecture directe servie par PrismCore (flux local) ; sa session, `gen`. */
    isPrismCore: boolean;
    prism?: { gen: number };
    /** Le chemin serveur à la position courante (transcodage forcé). */
    captureReloadTicks: () => void;
    setForceTranscode: (on: boolean) => void;
  };
}

/** Une erreur de FORMAT (codec, conteneur) : la chaîne de repli s'en charge. */
export function isFormatError(error: string): boolean {
  return error.includes("DECODING_FAILED") || error.includes("EXCEEDS_CAPABILITIES")
    || error.includes("codec") || error.includes("Could not open");
}
