import { useCallback, useEffect, useMemo, useReducer, useRef, type Dispatch } from "react";
import {
  INITIAL_TRAILER_PREVIEW_STATE,
  nextTrailerPreviewDeadline,
  reduceTrailerPreview,
  type TrailerPreviewEvent,
  type TrailerPreviewState,
} from "@tentacle-tv/shared";
import { tvTrailerPreviewTiming } from "@tentacle-tv/tv-core";
import { useTrailerPreviewDelay } from "../../lib/trailerPreviewSettings";

/**
 * La machine de l'aperçu (shared `previewMachine.ts`) branchée sur le focus
 * d'une carte : focus et blocage deviennent des évènements datés, et ses
 * échéances UNE minuterie — celle de la prochaine. Ses temps sont ceux du
 * salon au DÉLAI choisi sur ce téléviseur (tv-core `tvTrailerPreviewTiming`). Pas de pointeur : aucun
 * `move`. Le blocage passe avant le focus, pour qu'une carte bloquée qui naît
 * focalisée ne démarre rien. `since` : l'arrivée du focus, quand la session
 * n'est montée qu'après (`trailerPreviewDwell`) — le survol en est daté, le
 * rythme ne change pas.
 */
export function useTvPreviewMachine(
  focused: boolean,
  blocked: boolean,
  subjectKey: string | null,
  since: number | null = null,
): [TrailerPreviewState, Dispatch<TrailerPreviewEvent>] {
  const delay = useTrailerPreviewDelay();
  const timing = useMemo(() => tvTrailerPreviewTiming(delay), [delay]);
  const reducer = useCallback(
    (current: TrailerPreviewState, event: TrailerPreviewEvent) => reduceTrailerPreview(current, event, timing),
    [timing],
  );
  const [state, dispatch] = useReducer(reducer, INITIAL_TRAILER_PREVIEW_STATE);

  useEffect(() => {
    dispatch({ type: blocked ? "block" : "unblock", at: Date.now() });
  }, [blocked]);

  const focusedSince = useRef(since);
  focusedSince.current = since;
  useEffect(() => {
    const now = Date.now();
    dispatch({ type: focused ? "hover" : "unhover", at: focused ? Math.min(now, focusedSince.current ?? now) : now });
  }, [focused]);

  // Un autre titre sous le même focus (une carte recyclée) : un cycle neuf.
  const lastKey = useRef(subjectKey);
  useEffect(() => {
    if (lastKey.current === subjectKey) return;
    lastKey.current = subjectKey;
    dispatch({ type: "restart", at: Date.now() });
  }, [subjectKey]);

  const deadline = nextTrailerPreviewDeadline(state, timing);
  useEffect(() => {
    if (deadline === null) return undefined;
    const id = setTimeout(() => dispatch({ type: "tick", at: Date.now() }), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(id);
  }, [deadline]);

  return [state, dispatch];
}
