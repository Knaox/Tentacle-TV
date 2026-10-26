/**
 * Le fournisseur du moteur audio : UN moteur par application, démarré au
 * montage, arrêté au démontage. L'interface (le mode Octave) ne parle qu'au
 * port qu'il expose — jamais à mpv ni à un `<audio>`.
 *
 *   <AudioEngineProvider>…</AudioEngineProvider>
 *   const engine = useAudioEngine();        // le port, dès le premier rendu (différé tant que le moteur démarre)
 *   const state = useAudioEngineState();    // suit l'état (null sans moteur)
 *
 * L'authentification vient de la page : la racine du serveur Tentacle
 * (`getBackendBase`), le jeton et le mode cookie du client Jellyfin ; un changement de compte, de jeton ou de serveur
 * redémarre le moteur avec la nouvelle.
 *
 * `useAudioEngineState` suit les ÉVÈNEMENTS (quatre par seconde en lecture) ;
 * une barre de progression fluide relit `engine.getState()` à son rythme
 * (`requestAnimationFrame`) : la position y est extrapolée.
 */

import { createContext, useContext, useEffect, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { AudioEnginePort, EngineState } from "@tentacle-tv/shared/music";
import { createAudioEngine } from "./createAudioEngine";
import { getCrossfadeMs, subscribeCrossfade } from "./crossfadeSetting";
import { createDeferredEngine } from "./deferredEngine";
import { useMusicEngineAuth } from "./engineAuth";
import { adoptPrestartedEngine } from "./enginePrestart";
import type { EnginePrefs } from "./mpv/mpvAudioEngine";

const EngineContext = createContext<AudioEnginePort | null>(null);

const DEFAULT_PREFS: EnginePrefs = { volume: 1, muted: false, replayGain: "auto", deviceId: null, exclusive: false };

export function AudioEngineProvider({ children, prefs = DEFAULT_PREFS }: { children: ReactNode; prefs?: EnginePrefs }) {
  const auth = useMusicEngineAuth();
  const [engine, setEngine] = useState<AudioEnginePort | null>(null);

  // Effet de MISE EN PAGE : le port différé est posé avant la première peinture, la coquille
  // se dessine aussitôt ; le vrai moteur (démarré au geste s'il l'a été) le rejoint ensuite.
  useLayoutEffect(() => {
    // Les réglages du moment, pas une dépendance : l'interface les change par le port.
    const port = createDeferredEngine(adoptPrestartedEngine(auth) ?? createAudioEngine(auth, prefs), prefs);
    setEngine(port);
    return () => {
      port.dispose();
      setEngine(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- les préférences ne redémarrent pas le moteur
  }, [auth]);

  // La transition douce suit le réglage de l'appareil, même pendant l'écoute (le fondu suivant la prend).
  useEffect(() => {
    if (engine === null) return;
    const apply = () => engine.setCrossfade?.(getCrossfadeMs());
    apply();
    return subscribeCrossfade(apply);
  }, [engine]);

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
