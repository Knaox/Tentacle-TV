/**
 * Octave (mobile) — le lecteur de la session musique : le MOTEUR natif (`octave-audio`, derrière le moteur
 * différé partagé : la coquille se peint sans l'attendre) et la FILE (`OctavePlayer`, par la fabrique
 * partagée `buildOctavePlayer` d'api-client), montés avec le mode et démontés en le quittant — la musique
 * s'arrête en sortant d'Octave, comme au bureau. La même API que le web : `useOctavePlayer()` (gestes :
 * `playList`, `togglePlay`, `next`…), `usePlayerSelector`, `usePlayerPosition`, `useCurrentKey`.
 *
 *   <OctavePlayerProvider>…</OctavePlayerProvider>   (posé par la coquille, registre de m1)
 *   useOctavePlayer().playList(tracks, index, "album:<id>");
 */

import { createContext, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { attachPlayerResume, buildOctavePlayer, followSearchWithRadio, useTentacleConfig } from "@tentacle-tv/api-client";
import { createDeferredEngine, type EnginePrefs, type OctavePlayer, type PlayerSnapshot, type PositionState } from "@tentacle-tv/shared/octave";
import { bindCrossfadeStorage, getCrossfadeMs, subscribeCrossfade } from "../audio/crossfadeSetting";
import { followKeptCopies } from "../audio/keptCopySwap";
import { createMobileAudioEngine } from "../audio/mobileAudioEngine";
import { keepJsAliveWhilePlaying } from "../audio/musicKeepAlive";
import { useMobileEngineAuth } from "../audio/useMobileEngineAuth";
import { useMobileMusicProvider } from "../audio/useMobileMusicProvider";
import { keptPlaybackSource, withKeptSources } from "../offline/keptPlayback";
import { mobileResumeDeps, octaveOwnerOf } from "./playerResumeMobile";

const PlayerContext = createContext<OctavePlayer | null>(null);

/** Le volume se règle aux boutons de l'appareil : le moteur reste à 1. */
const PREFS: EnginePrefs = { volume: 1, muted: false, replayGain: "auto", deviceId: null, exclusive: false };

export function OctavePlayerProvider({ children }: { children: ReactNode }) {
  const auth = useMobileEngineAuth();
  const qc = useQueryClient();
  const { storage } = useTentacleConfig();
  const provider = useMobileMusicProvider();
  const providerRef = useRef(provider);
  providerRef.current = provider;
  const [player, setPlayer] = useState<OctavePlayer | null>(null);
  bindCrossfadeStorage(storage);

  useLayoutEffect(() => {
    if (auth.baseUrl === "") return;
    const engine = createDeferredEngine(createMobileAudioEngine(auth, PREFS), PREFS);
    const owner = octaveOwnerOf(storage, auth.baseUrl);
    // La copie gardée d'abord (en ligne comme sans serveur), comme au bureau : rien à préparer chez l'extension.
    // Les sources résolues survivent à la sortie d'Octave : y revenir et relancer un titre ne les redemande pas.
    const p = buildOctavePlayer(engine, qc, () => providerRef.current, {
      wrapSources: withKeptSources,
      isKept: (key) => keptPlaybackSource(key) !== null,
      retainSourcesFor: owner,
    });
    // Après le premier son d'un titre de recherche, sa radio devient la suite (comme au bureau).
    const offRadio = followSearchWithRadio(p, () => providerRef.current);
    // La transition douce suit le réglage de l'appareil, même pendant l'écoute (le fondu suivant la prend).
    const applyCrossfade = () => engine.setCrossfade?.(getCrossfadeMs());
    applyCrossfade();
    const offCrossfade = subscribeCrossfade(applyCrossfade);
    // La session quittée revient en pause (dernier titre, file, position), comme au bureau.
    const offResume = attachPlayerResume(p, owner, mobileResumeDeps(storage, auth.baseUrl));
    // … et sa source se prépare tout de suite (en fond) : le premier « Lecture » n'attend rien.
    const resumed = p.snapshot.get().current;
    if (p.restoredAtMs !== null && resumed) p.prefetch([resumed], "next");
    // Un titre gardé passe au fichier du téléphone dès que sa copie est connue, même en cours d'écoute.
    const offKept = followKeptCopies(p);
    // Android : la file avance application derrière (minuteurs du JS gardés vivants pendant l'écoute).
    const offAlive = keepJsAliveWhilePlaying(p);
    // Bancs de développement seulement : le lecteur lisible par l'inspecteur (Hermes), jamais dans un build livré.
    if (__DEV__) Object.assign(globalThis, { __octavePlayer: p, __octaveAuth: auth });
    setPlayer(p);
    return () => {
      offKept();
      offAlive();
      offResume();
      offCrossfade();
      offRadio();
      p.dispose();
      engine.dispose();
      setPlayer(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- le stockage de l'app ne change pas
  }, [auth, qc]);

  if (!player) return null;
  return <PlayerContext.Provider value={player}>{children}</PlayerContext.Provider>;
}

/** Le lecteur, ou `null` hors d'Octave (un composant partagé peut s'en passer). */
export function useOptionalOctavePlayer(): OctavePlayer | null {
  return useContext(PlayerContext);
}

export function useOctavePlayer(): OctavePlayer {
  const player = useContext(PlayerContext);
  if (!player) throw new Error("useOctavePlayer hors d'OctavePlayerProvider");
  return player;
}

/** Une tranche de l'instantané : le composant ne se redessine que si elle change. */
export function usePlayerSelector<T>(select: (s: PlayerSnapshot) => T): T {
  const player = useOctavePlayer();
  const read = () => select(player.snapshot.get());
  return useSyncExternalStore(player.snapshot.subscribe, read, read);
}

export function usePlayerPosition(): PositionState {
  const player = useOctavePlayer();
  return useSyncExternalStore(player.position.subscribe, player.position.get, player.position.get);
}

/** La clé du titre en cours (ou `null`) — pour marquer « en lecture » dans les listes. */
export function useCurrentKey(): string | null {
  return usePlayerSelector((s) => s.current?.key ?? null);
}
