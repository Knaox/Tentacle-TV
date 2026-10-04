import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { INITIAL_REVIVAL, revivalReducer } from "./webViewRevival";

/**
 * Fait renaître la page d'une extension dont le processus de rendu a été
 * repris (règle et raisons : `webViewRevival.ts`). À brancher sur la WebView :
 * `key` (une WebView neuve par renaissance), `onLost` sur
 * `onContentProcessDidTerminate` (iOS) ET `onRenderProcessGone` (Android),
 * `onReady` au READY du pont ; tant que `lost`, la WebView n'est pas montée.
 *
 * `active` : le volet est celui qu'on regarde (un volet caché d'un écran n'a
 * rien à recharger). S'y ajoutent le focus de l'écran et l'app au premier plan.
 */
export function useWebViewRevival(active = true) {
  const [state, dispatch] = useReducer(revivalReducer, INITIAL_REVIVAL);

  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => setForeground(next === "active"));
    return () => sub.remove();
  }, []);

  const visible = active && focused && foreground;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  useEffect(() => {
    if (state.lost && visible) dispatch({ type: "shown" });
  }, [state.lost, visible]);

  const onReady = useCallback(() => dispatch({ type: "ready" }), []);
  const onLost = useCallback(() => dispatch({ type: "lost", visible: visibleRef.current }), []);
  const retry = useCallback(() => dispatch({ type: "retry" }), []);

  return { generation: state.generation, lost: state.lost, crashed: state.crashed, onReady, onLost, retry };
}
