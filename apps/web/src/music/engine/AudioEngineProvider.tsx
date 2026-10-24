/**
 * Le fournisseur du moteur audio : UN moteur par application, démarré au
 * montage, arrêté au démontage. L'interface (le mode Octave) ne parle qu'au
 * port qu'il expose — jamais à mpv ni à un `<audio>`.
 *
 *   <AudioEngineProvider>…</AudioEngineProvider>
 *   const engine = useAudioEngine();        // null tant qu'il démarre
 *   const state = useAudioEngineState();    // suit l'état (null sans moteur)
 *
 * L'authentification vient du client Jellyfin de la page (le serveur Tentacle,
 * son jeton, cookie ou non) ; un changement de compte, de jeton ou de serveur
 * redémarre le moteur avec la nouvelle.
 *
 * `useAudioEngineState` suit les ÉVÈNEMENTS (quatre par seconde en lecture) ;
 * une barre de progression fluide relit `engine.getState()` à son rythme
 * (`requestAnimationFrame`) : la position y est extrapolée.
 */

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { AudioEnginePort, EngineState } from "@tentacle-tv/shared/music";
import { createAudioEngine } from "./createAudioEngine";
import type { MusicEngineAuth } from "./engineShared";
import type { EnginePrefs } from "./mpv/mpvAudioEngine";

const EngineContext = createContext<AudioEnginePort | null>(null);

const DEFAULT_PREFS: EnginePrefs = { volume: 1, muted: false, replayGain: "auto", deviceId: null, exclusive: false };

export function AudioEngineProvider({ children, prefs = DEFAULT_PREFS }: { children: ReactNode; prefs?: EnginePrefs }) {
  const client = useJellyfinClient();
  const baseUrl = client.getBaseUrl();
  const token = client.getToken();
  const useCredentials = client.useCredentials;
  const auth = useMemo<MusicEngineAuth>(() => ({ baseUrl, token, useCredentials }), [baseUrl, token, useCredentials]);
  const [engine, setEngine] = useState<AudioEnginePort | null>(null);

  useEffect(() => {
    let alive = true;
    let started: AudioEnginePort | null = null;
    // Les réglages du moment, pas une dépendance : l'interface les change par le port.
    void createAudioEngine(auth, prefs).then((e) => {
      if (!alive) return e.dispose();
      started = e;
      setEngine(e);
    });
    return () => {
      alive = false;
      started?.dispose();
      setEngine(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- les préférences ne redémarrent pas le moteur
  }, [auth]);

  return <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>;
}

export function useAudioEngine(): AudioEnginePort | null {
  return useContext(EngineContext);
}

const noop = (): (() => void) => () => undefined;

/** L'état du moteur, suivi par ses évènements (`useSyncExternalStore`). */
export function useAudioEngineState(): EngineState | null {
  const engine = useAudioEngine();
  return useSyncExternalStore(
    engine === null ? noop : (onChange) => engine.subscribe((e) => e.type === "state" && onChange()),
    () => (engine === null ? null : engineSnapshot(engine)),
  );
}

/**
 * `getState()` rend un objet neuf à chaque appel (position extrapolée) :
 * `useSyncExternalStore` exige un instantané STABLE entre deux évènements.
 */
const snapshots = new WeakMap<AudioEnginePort, { at: EngineState; raw: EngineState }>();
function engineSnapshot(engine: AudioEnginePort): EngineState {
  const raw = engine.getState();
  const last = snapshots.get(engine);
  if (last !== undefined && sameState(last.raw, raw)) return last.at;
  snapshots.set(engine, { at: raw, raw });
  return raw;
}

function sameState(a: EngineState, b: EngineState): boolean {
  return a.status === b.status && a.trackKey === b.trackKey && a.durationMs === b.durationMs && a.volume === b.volume
    && a.muted === b.muted && a.error === b.error && a.format === b.format && a.output.deviceId === b.output.deviceId
    && a.output.exclusive === b.output.exclusive && Math.abs(a.positionMs - b.positionMs) < 250;
}
