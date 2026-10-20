import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useStillWatching, type StillWatchingController } from "@tentacle-tv/api-client";
import { engineResumeIsPresence } from "./enginePresence";

interface Options {
  /** L'état de pause que l'écran tient (et donne au moteur). */
  paused: boolean;
  /** Le moteur charge : ce temps-là n'est pas de la lecture. */
  buffering: boolean;
  /** La lecture a vraiment démarré (image et position qui avance). */
  started: boolean;
  setPaused: (paused: boolean) => void;
  /** Faux : la fonction se tait — une séance Watch Together, comme au bureau (`DesktopPlayer`). */
  enabled?: boolean;
}

export interface MobileStillWatching extends StillWatchingController {
  /** À donner au moteur à la place de `setPaused` : une reprise venue du système compte comme une présence. */
  onPausedChange: (paused: boolean) => void;
}

/**
 * « Vous regardez encore ? » câblé pour le lecteur mobile — la règle et le
 * réglage sont communs (`useStillWatching`, api-client) ; ce crochet ne dit
 * que d'où vient « ça tourne », comment mettre en pause et relancer, et
 * quelles reprises du moteur prouvent une présence (`enginePresence.ts`).
 *
 * Comme au bureau, elle se tait quand la question ne serait pas VUE : app en
 * arrière-plan (image dans l'image d'iOS, lecture en fond) — le bureau la tait
 * dans son PiP —, et pendant une séance Watch Together (`enabled`, que le
 * lecteur donne). Les touchers (habillage, gestes, barre de lecture) passent par
 * `onActivity` de la surface vidéo → `reportActivity`.
 */
export function useMobileStillWatching({ paused, buffering, started, setPaused, enabled = true }: Options): MobileStillWatching {
  const pause = useCallback(() => setPaused(true), [setPaused]);
  const play = useCallback(() => setPaused(false), [setPaused]);
  const visible = useAppVisible();
  const controller = useStillWatching({ playing: started && !paused && !buffering, enabled: enabled && visible, pause, play });

  // L'état demandé, lu au moment où le moteur répond (l'écho suit le rendu).
  const requestedPaused = useRef(paused);
  requestedPaused.current = paused;
  const { reportActivity } = controller;
  const onPausedChange = useCallback((reported: boolean) => {
    if (engineResumeIsPresence(requestedPaused.current, reported)) reportActivity();
    setPaused(reported);
  }, [reportActivity, setPaused]);

  return { ...controller, onPausedChange };
}

/** L'app au premier plan : en arrière-plan (PiP d'iOS, lecture en fond), l'encart ne serait pas vu. */
function useAppVisible(): boolean {
  const [visible, setVisible] = useState(AppState.currentState !== "background");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setVisible(state !== "background"));
    return () => subscription.remove();
  }, []);
  return visible;
}
