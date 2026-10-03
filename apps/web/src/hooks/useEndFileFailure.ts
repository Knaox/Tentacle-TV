import { useCallback, type MutableRefObject } from "react";
import type { PlayOptions } from "./mpvRuntime";
import { classifyEndFileFailure, type PlaybackFailure } from "./playbackFailure";
import type { LocalMediaProbe } from "./useLocalMediaProbe";
import type { MpvEndFileEvent } from "../lib/mpvTypes";
import { traceCommand } from "./startupTrace";
import { wtLog } from "../watchTogether/wtLog";

interface EndFileFailureArgs {
  lastPlayRef: MutableRefObject<{ options: PlayOptions; attempt: number } | null>;
  play: (options: PlayOptions, attempt?: number) => Promise<void> | void;
  setFileLoaded: (loaded: boolean) => void;
  setFailure: (failure: PlaybackFailure | null) => void;
  probeLocalMedia?: LocalMediaProbe;
}

/**
 * Un `end-file(ERROR)` de mpv, traité. Extrait de `useDesktopPlayer` (limite
 * de 300 lignes).
 *
 * - **Au chargement** (le cycle de vie a désarmé le watchdog) : même
 *   sémantique deux-tentatives que le watchdog, sans ses attentes mortes —
 *   l'échec est explicite. Mesuré (rejeu du 28.08) : fichier local illisible
 *   = end-file(4) immédiat, deux fois ; la bascule part en moins d'une seconde.
 * - **En pleine lecture** : l'image restait figée, sans un mot. L'échec
 *   remonte, marqué `started` — la page le diagnostique (coupure, serveur,
 *   fichier) et propose de reprendre là où la lecture s'est arrêtée.
 */
export function useEndFileFailure({ lastPlayRef, play, setFileLoaded, setFailure, probeLocalMedia }: EndFileFailureArgs) {
  return useCallback((endFile: MpvEndFileEvent, loading: boolean) => {
    const last = lastPlayRef.current;
    if (loading && last !== null && last.attempt === 1) {
      wtLog("mpv", `end-file en erreur pendant le chargement (error=${endFile.error ?? "-"}) — retry immédiat`);
      traceCommand("retry loadfile (end-file en erreur)", `error=${endFile.error ?? "-"}`);
      void play(last.options, 2);
      return;
    }
    wtLog("mpv", `end-file en erreur ${loading ? "après retry" : "en pleine lecture"} (error=${endFile.error ?? "-"}) — classement`);
    setFileLoaded(true); // débloque l'UI, comme le watchdog
    void (async () => {
      const present = probeLocalMedia !== undefined ? await probeLocalMedia() : null;
      const failure = classifyEndFileFailure({
        errorCode: endFile.error,
        isLocalPlayback: probeLocalMedia !== undefined,
        localFilePresent: present,
      });
      setFailure(loading ? failure : { ...failure, started: true });
    })();
  }, [lastPlayRef, play, setFileLoaded, setFailure, probeLocalMedia]);
}
