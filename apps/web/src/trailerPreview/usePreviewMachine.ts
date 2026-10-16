import { useCallback, useEffect, useMemo, useReducer, useRef, type Dispatch } from "react";
import {
  INITIAL_TRAILER_PREVIEW_STATE,
  TRAILER_PREVIEW_TIMING,
  WEB_TRAILER_PREVIEW_PACE,
  nextTrailerPreviewDeadline,
  reduceTrailerPreview,
  trailerPreviewTimingFor,
  type TrailerPreviewEvent,
  type TrailerPreviewState,
} from "@tentacle-tv/shared";
import { subscribePointerMotion } from "./pointerMotion";
import { useTrailerPreviewDelay } from "./previewSettings";

/**
 * La machine de l'aperçu (`previewMachine.ts`, shared) branchée sur React :
 * ses entrées (survol, blocage, sujet qui change, pointeur qui bouge pendant
 * l'intention) deviennent des évènements datés, et ses échéances UNE
 * minuterie — celle de la prochaine.
 *
 * Ses temps suivent le DÉLAI choisi sur l'appareil (shared `previewDelay.ts`) :
 * la mini-carte paraît au délai, la demande part avant lui.
 *
 * L'ordre des effets compte : le blocage passe avant le survol, pour qu'un
 * survol présent dès le montage d'une carte bloquée ne démarre rien.
 */
export function usePreviewMachine(
  hovered: boolean,
  blocked: boolean,
  subjectKey: string | null,
): [TrailerPreviewState, Dispatch<TrailerPreviewEvent>] {
  const [delay] = useTrailerPreviewDelay();
  const timing = useMemo(() => trailerPreviewTimingFor(TRAILER_PREVIEW_TIMING, delay, WEB_TRAILER_PREVIEW_PACE), [delay]);
  const reducer = useCallback(
    (current: TrailerPreviewState, event: TrailerPreviewEvent) => reduceTrailerPreview(current, event, timing),
    [timing],
  );
  const [state, dispatch] = useReducer(reducer, INITIAL_TRAILER_PREVIEW_STATE);

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

  // Pendant l'intention seulement : le pointeur qui bouge repousse la demande (`pointerMotion.ts`).
  const awaitingIntent = state.phase === "intent";
  useEffect(() => {
    if (!awaitingIntent) return;
    return subscribePointerMotion(() => dispatch({ type: "move", at: Date.now() }));
  }, [awaitingIntent]);

  const deadline = nextTrailerPreviewDeadline(state, timing);
  useEffect(() => {
    if (deadline === null) return;
    const id = window.setTimeout(() => dispatch({ type: "tick", at: Date.now() }), Math.max(0, deadline - Date.now()));
    return () => window.clearTimeout(id);
  }, [deadline]);

  return [state, dispatch];
}
