import { useCallback, useRef } from "react";
import { useIsFocused } from "@react-navigation/native";
import { useStillWatching, type StillWatchingController } from "@tentacle-tv/api-client";
import { stillWatchingRemoteAnswer } from "@tentacle-tv/tv-core";
import { useRemoteIntents } from "../platform/input";

export interface TVStillWatching extends StillWatchingController {
  /** L'encart est là (question ou pause) : il tient la télécommande, comme un panneau. */
  shown: boolean;
}

/**
 * « Vous regardez encore ? » câblé pour le lecteur TV (Apple TV, Android TV) :
 * le minuteur et le réglage du compte sont communs (`useStillWatching`,
 * api-client) ; ce crochet dit d'où vient « ça tourne », comment mettre en
 * pause et relancer, et ce que fait chaque appui de la télécommande — vu
 * passer à l'ENTRÉE UNIQUE de la plateforme (`useRemoteIntents`), traduit par
 * la règle de tv-core (`stillWatchingRemoteAnswer`). Le lecteur ne prend rien :
 * l'encart affiché, ses propres gestes se taisent (`panelOpen`).
 *
 * Pas de Watch Together sur les téléviseurs : la fonction n'a rien à y taire.
 */
export function useTVStillWatching({ playing, setPaused }: {
  /** La lecture tourne vraiment (commencée, ni pause, ni chargement, ni fin). */
  playing: boolean;
  setPaused: (paused: boolean) => void;
}): TVStillWatching {
  const pause = useCallback(() => setPaused(true), [setPaused]);
  const play = useCallback(() => setPaused(false), [setPaused]);
  const controller = useStillWatching({ playing, pause, play });

  const latest = useRef(controller);
  latest.current = controller;
  const focused = useIsFocused();
  useRemoteIntents((event) => {
    const current = latest.current;
    switch (stillWatchingRemoteAnswer(current.phase, event.intent)) {
      case "activity": current.reportActivity(); break;
      case "keepWatching": current.keepWatching(); break;
      case "pauseNow": current.pauseNow(); break;
      case "resume": current.resume(); break;
      default: break;
    }
  }, focused);

  return { ...controller, shown: controller.phase !== "none" };
}
