import { useEffect } from "react";

interface Options {
  streamUrl: string | null | undefined;
  videoReady: boolean;
  playerError: string | null;
  retryCount: { current: number };
  retryingRef: { current: boolean };
  /** La relance transcodée, sur le lecteur système. */
  retryTranscoded: () => void;
  /** Deuxième échec : l'écran d'erreur. */
  fail: () => void;
}

/** Au-delà, un flux qui n'a toujours rien chargé est tenu pour perdu. */
const LOADING_TIMEOUT_MS = 20_000;

/**
 * Le chien de garde du chargement — extrait de `PlayerScreen` (limite de 300
 * lignes). Si le moteur n'a rien chargé au bout de 20 s, une relance
 * transcodée ; si elle échoue à son tour, l'écran d'erreur.
 */
export function usePlayerLoadingWatchdog({
  streamUrl, videoReady, playerError, retryCount, retryingRef, retryTranscoded, fail,
}: Options): void {
  useEffect(() => {
    if (!streamUrl || videoReady) return;
    const timer = setTimeout(() => {
      if (!videoReady && !playerError && !retryingRef.current) {
        console.log("[Tentacle:Player] loading timeout (20s) — URL:", streamUrl.slice(0, 200));
        if (retryCount.current < 1) {
          retryCount.current++;
          retryingRef.current = true;
          retryTranscoded();
        } else {
          fail();
        }
      }
    }, LOADING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [streamUrl, videoReady]); // eslint-disable-line react-hooks/exhaustive-deps
}
