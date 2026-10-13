import { useEffect, useReducer, useRef, type Dispatch } from "react";
import {
  INITIAL_TRAILER_PREVIEW_STATE,
  nextTrailerPreviewDeadline,
  trailerPreviewReducer,
  type TrailerPreviewEvent,
  type TrailerPreviewState,
} from "@tentacle-tv/shared";

/**
 * La machine de l'aperçu (`previewMachine.ts`, shared) branchée sur React :
 * ses entrées (survol, blocage, sujet qui change) deviennent des évènements
 * datés, et ses échéances UNE minuterie — celle de la prochaine.
 *
 * L'ordre des effets compte : le blocage passe avant le survol, pour qu'un
 * survol présent dès le montage d'une carte bloquée ne démarre rien.
 */
export function usePreviewMachine(
  hovered: boolean,
  blocked: boolean,
  subjectKey: string | null,
): [TrailerPreviewState, Dispatch<TrailerPreviewEvent>] {
  const [state, dispatch] = useReducer(trailerPreviewReducer, INITIAL_TRAILER_PREVIEW_STATE);

  useEffect(() => {
    dispatch({ type: blocked ? "block" : "unblock", at: Date.now() });
  }, [blocked]);

  useEffect(() => {
    dispatch({ type: hovered ? "hover" : "unhover", at: Date.now() });
  }, [hovered]);

  // Un autre titre sous le même survol (la carte a changé de contenu) : un cycle neuf.
  const lastKey = useRef(subjectKey);
  useEffect(() => {
    if (lastKey.current === subjectKey) return;
    lastKey.current = subjectKey;
    dispatch({ type: "restart", at: Date.now() });
  }, [subjectKey]);

  const deadline = nextTrailerPreviewDeadline(state);
  useEffect(() => {
    if (deadline === null) return;
    const id = window.setTimeout(() => dispatch({ type: "tick", at: Date.now() }), Math.max(0, deadline - Date.now()));
    return () => window.clearTimeout(id);
  }, [deadline]);

  return [state, dispatch];
}
