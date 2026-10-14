import { useEffect, useReducer, useRef, type Dispatch } from "react";
import {
  INITIAL_TRAILER_PREVIEW_STATE,
  nextTrailerPreviewDeadline,
  reduceTrailerPreview,
  type TrailerPreviewEvent,
  type TrailerPreviewState,
} from "@tentacle-tv/shared";
import { TV_TRAILER_PREVIEW_TIMING } from "@tentacle-tv/tv-core";

/** Le réducteur de la machine aux temps du salon (tv-core `TV_TRAILER_PREVIEW_TIMING`). */
function tvPreviewReducer(state: TrailerPreviewState, event: TrailerPreviewEvent): TrailerPreviewState {
  return reduceTrailerPreview(state, event, TV_TRAILER_PREVIEW_TIMING);
}

/**
 * La machine de l'aperçu (shared `previewMachine.ts`) branchée sur le focus
 * d'une carte : focus et blocage deviennent des évènements datés, et ses
 * échéances UNE minuterie — celle de la prochaine. Pas de pointeur : aucun
 * `move`. Le blocage passe avant le focus, pour qu'une carte bloquée qui naît
 * focalisée ne démarre rien.
 */
export function useTvPreviewMachine(
  focused: boolean,
  blocked: boolean,
  subjectKey: string | null,
): [TrailerPreviewState, Dispatch<TrailerPreviewEvent>] {
  const [state, dispatch] = useReducer(tvPreviewReducer, INITIAL_TRAILER_PREVIEW_STATE);

  useEffect(() => {
    dispatch({ type: blocked ? "block" : "unblock", at: Date.now() });
  }, [blocked]);

  useEffect(() => {
    dispatch({ type: focused ? "hover" : "unhover", at: Date.now() });
  }, [focused]);

  // Un autre titre sous le même focus (une carte recyclée) : un cycle neuf.
  const lastKey = useRef(subjectKey);
  useEffect(() => {
    if (lastKey.current === subjectKey) return;
    lastKey.current = subjectKey;
    dispatch({ type: "restart", at: Date.now() });
  }, [subjectKey]);

  const deadline = nextTrailerPreviewDeadline(state, TV_TRAILER_PREVIEW_TIMING);
  useEffect(() => {
    if (deadline === null) return undefined;
    const id = setTimeout(() => dispatch({ type: "tick", at: Date.now() }), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(id);
  }, [deadline]);

  return [state, dispatch];
}
