import { useEffect } from "react";
import { useJellyfinOutage } from "@tentacle-tv/api-client";

interface Options {
  streamUrl: string | null | undefined;
  videoReady: boolean;
  /** Un échec est déjà dit (ou en diagnostic) : rien à relancer derrière lui. */
  suspended: boolean;
  retryCount: { current: number };
  retryingRef: { current: boolean };
  /** La relance transcodée, sur le lecteur système. */
  retryTranscoded: () => void;
  /** Deuxième échec : le message (diagnostiqué). */
  fail: () => void;
}

/** Au-delà, un flux qui n'a toujours rien chargé est tenu pour perdu. */
const LOADING_TIMEOUT_MS = 20_000;

/**
 * Le chien de garde du chargement — extrait de `PlayerScreen` (limite de 300
 * lignes). Si le moteur n'a rien chargé au bout de 20 s, une relance
 * transcodée ; si elle échoue à son tour, le message.
 */
export function usePlayerLoadingWatchdog({
  streamUrl, videoReady, suspended, retryCount, retryingRef, retryTranscoded, fail,
}: Options): void {
  // Jellyfin en panne (dit par le serveur) : rien ne peut charger, et une relance
  // transcodée y perdrait un palier pour rien. Le retour rouvre le flux.
  const outage = useJellyfinOutage();
  const down = outage.phase === "outage" || outage.phase === "long";
  useEffect(() => {
    if (!streamUrl || videoReady || suspended || down) return;
    const timer = setTimeout(() => {
      if (!videoReady && !retryingRef.current) {
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
  }, [streamUrl, videoReady, suspended, down]); // eslint-disable-line react-hooks/exhaustive-deps
}
