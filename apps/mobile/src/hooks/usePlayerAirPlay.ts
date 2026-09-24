import { useCallback, useState, type RefObject } from "react";
import { isAirPlayRouteActive } from "../../modules/mpv-player";
import { useAirPlayRestoreSeek, useAirPlayRouteWatch } from "@/player/engine/useAirPlayRoute";
import type { PlayerEngineState } from "@/player/engine/usePlayerEngine";
import type { PlayerEngineHandle } from "@/player/engine/types";
import { startTicksOf, type usePlayerPlayback } from "./usePlayerPlayback";

interface Options {
  eng: PlayerEngineState;
  pb: ReturnType<typeof usePlayerPlayback>;
  engineRef: RefObject<PlayerEngineHandle | null>;
  videoReady: boolean;
  /** Une bascule repart avec un budget de relance neuf. */
  retryCount: { current: number };
}

/**
 * AirPlay, dans les deux sens — extrait de `PlayerScreen` (limite de 300
 * lignes). Apparu pendant une lecture par le lecteur avancé (qui ne diffuse
 * pas) : le lecteur système prend le relais à la même position, avec SON
 * profil — remux ou transcodage serveur acceptés, c'est le cas nécessaire.
 * Éteint : le lecteur avancé reprend à la même seconde, là où le système ne le
 * remplaçait que pour AirPlay. Une négociation par bascule.
 */
export function usePlayerAirPlay({ eng, pb, engineRef, videoReady, retryCount }: Options) {
  const [isAirPlaying, setIsAirPlaying] = useState(false);

  const onAirPlayRoute = useCallback((active: boolean) => {
    setIsAirPlaying(active);
    const next = eng.setAirPlayRoute(active);
    if (next === pb.engine) return;
    console.log("[Tentacle:Player] AirPlay", active ? "actif" : "éteint", "— bascule vers", next, "à", Math.round(pb.positionRef.current), "s");
    retryCount.current = 0;
    pb.fetchPlaybackInfo({ engine: next, startTimeTicks: startTicksOf(pb.positionRef.current) });
  }, [eng, pb.engine, pb.fetchPlaybackInfo, pb.positionRef, retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Le lecteur système annonce l'état AirPlay de son AVPlayer — qui passe par
  // `false` puis `true` à chaque remplacement d'item. Le front descendant se
  // vérifie contre la route audio, seule vérité une fois la vue mpv démontée.
  const restoreAfterAirPlay = useAirPlayRestoreSeek({
    engineRef, positionRef: pb.positionRef, streamOffset: pb.streamOffset, videoReady,
  });
  const onExternalPlaybackChange = useCallback((active: boolean) => {
    restoreAfterAirPlay(active);
    onAirPlayRoute(active || isAirPlayRouteActive());
  }, [restoreAfterAirPlay, onAirPlayRoute]);

  // Filet : si l'AVPlayer annonce la fin d'AirPlay avant que la route audio
  // ne bascule, personne ne rappellerait — la route est relue chaque seconde
  // tant que le lecteur système diffuse.
  useAirPlayRouteWatch(isAirPlaying && pb.engine === "native", onAirPlayRoute);

  return { isAirPlaying, onAirPlayRoute, onExternalPlaybackChange };
}
