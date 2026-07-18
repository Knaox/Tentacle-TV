import { useEffect, useRef } from "react";
import { BackHandler, Platform } from "react-native";
import { useIsFocused } from "@react-navigation/native";

// react-native-tvos 0.76 exports useTVEventHandler as a hook (not a class)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useTVEventHandler } = require("react-native") as {
  useTVEventHandler: (callback: (evt: { eventType: string; eventKeyAction?: number }) => void) => void;
};

interface TVRemoteOptions {
  onBack?: () => void;
  onPlayPause?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  onUp?: () => void;
  onDown?: () => void;
  /** Called on long-press D-pad left (Android TV emits once after ~300ms hold) */
  onLongLeft?: () => void;
  /** Called on long-press D-pad right (Android TV emits once after ~300ms hold) */
  onLongRight?: () => void;
  /** Called on key-up (ACTION_UP) for any event type — used to detect release */
  onKeyUp?: (eventType: string) => void;
  /** Called on rewind button (dedicated Shield remote button) */
  onRewind?: () => void;
  /** Called on fast-forward button (dedicated Shield remote button) */
  onFastForward?: () => void;
  /** Called on any D-pad direction or select — useful for re-showing overlays */
  onAnyPress?: () => void;
  /** Called on SELECT (OK) specifically — ex. valider le scrub où qu'en soit le focus */
  onSelect?: () => void;
  /** TODO(diag): log des événements select/longSelect/media (transitions) — À RETIRER */
  debugTag?: string;
}

/**
 * Hook for handling TV remote events.
 * Uses react-native-tvos useTVEventHandler hook.
 *
 * Note: react-native-tvos sends most events as action=1 (key-up only).
 * Only longLeft/longRight arrive as action=0 (key-down).
 *
 * IMPORTANT : avec la native-stack, les écrans d'ARRIÈRE-PLAN restent montés —
 * leurs handlers restent donc enregistrés. Sans garde, BackHandler (LIFO : le
 * dernier enregistré gagne) était systématiquement volé par un écran invisible
 * qui se ré-enregistrait à chaque render → BACK « mort » sur l'écran visible.
 * Chaque consommateur ne réagit désormais que si SON écran est focused.
 */
export function useTVRemote(options: TVRemoteOptions) {
  // Store latest callbacks in ref to avoid stale closures
  const optRef = useRef(options);
  optRef.current = options;

  const isFocused = useIsFocused();
  const focusedRef = useRef(isFocused);
  focusedRef.current = isFocused;

  // Android + ReactFeatureFlags.enableKeyDownEvents (MainApplication.kt) :
  // chaque pression émet key-DOWN (a=0, avec répétitions de maintien) PUIS
  // key-UP (a=1). On agit au DOWN (réactivité, et les répétitions alimentent le
  // scrub) et on n'exécute PAS l'action du up jumeau. Les types qui n'émettent
  // pas de down (tvOS, certaines touches) gardent le comportement historique.
  const sawDownRef = useRef<Set<string>>(new Set());

  // Handle Android TV back button — enregistrement STABLE (une seule fois),
  // gate sur l'écran focused. `return false` quand on ne gère pas : le système
  // (native-stack) applique alors son pop par défaut au lieu d'un blocage.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!focusedRef.current) return false;
      const onBack = optRef.current.onBack;
      if (!onBack) return false;
      onBack();
      return true;
    });
    return () => handler.remove();
  }, []);

  // Handle all TV remote events
  useTVEventHandler((evt: { eventType: string; eventKeyAction?: number }) => {
    // Écran d'arrière-plan : ignorer (sinon actions fantômes sur les écrans
    // empilés — seek du player pendant qu'on est sur le trailer, etc.)
    if (!focusedRef.current) return;
    const o = optRef.current;
    const { eventType, eventKeyAction } = evt;

    // Ignore focus system noise
    if (eventType === "blur" || eventType === "focus") return;

    if (o.debugTag && (eventType === "select" || eventType === "longSelect" || eventType === "rewind" || eventType === "fastForward")) {
      // TODO(diag): transitions uniquement (pas les répétitions déjà vues) — À RETIRER
      if (!(eventKeyAction === 0 && sawDownRef.current.has(eventType))) {
        console.log(`[TVEVT:${o.debugTag}] ${eventType} a=${eventKeyAction}`);
      }
    }

    // Android : le « back » TVEvent doublerait BackHandler (déjà branché plus
    // haut) — on l'ignore ici quel que soit son action.
    if (Platform.OS === "android" && (eventType === "menu" || eventType === "back")) return;

    // longLeft/longRight : action=0 = DÉBUT du maintien (→ avance rapide).
    // TOUTE autre valeur — 1 (Ended) ou undefined (recognizer tvOS en état
    // Cancelled/Failed/Changed : eventKeyAction est nil) — signifie que
    // l'appui n'est PLUS actif : traiter en RELÂCHEMENT, et ne JAMAIS
    // retomber dans le switch. Sans ça, un long-press ANNULÉ par tvOS ne
    // stoppait jamais le tick d'avance (avance rapide infinie) et pouvait
    // même la relancer après le lever du doigt.
    if (eventType === "longLeft" || eventType === "longRight") {
      if (eventKeyAction === 0) {
        if (eventType === "longLeft") o.onLongLeft?.();
        else o.onLongRight?.();
      } else {
        o.onKeyUp?.(eventType);
      }
      return;
    }

    // Key-down (a=0, y compris répétitions de maintien) : agir, et mémoriser
    // que ce type a été traité au down — son key-up jumeau ne ré-agira pas.
    if (eventKeyAction === 0) {
      sawDownRef.current.add(eventType);
    }

    // Key-up: notify for hold release detection
    if (eventKeyAction === 1) {
      o.onKeyUp?.(eventType);
      // Action déjà exécutée au key-down correspondant → ne pas doubler.
      if (sawDownRef.current.has(eventType)) {
        sawDownRef.current.delete(eventType);
        return;
      }
      // Android : "select" agit TOUJOURS au down (enableKeyDownEvents garantit
      // le key-down). Un up ORPHELIN (rafale déséquilibrée, down consommé côté
      // natif pendant un maintien) ne doit jamais exécuter l'action — c'est lui
      // qui « confirmait tout seul » le scrub au relâchement.
      if (Platform.OS === "android" && eventType === "select") return;
      // Block up/down/menu/back on key-up — these should NOT fire on action=1
      // (otherwise key-up "down" triggers onDown → scrubbing mode, breaking DPAD seek)
      if (eventType === "up" || eventType === "down" || eventType === "menu" || eventType === "back") return;
      // Only let directional seeks and playback controls fall through on key-up
    }

    switch (eventType) {
      case "menu":
      case "back":
        o.onBack?.();
        break;
      case "playPause":
        o.onPlayPause?.();
        break;
      case "left":
        o.onLeft?.();
        o.onAnyPress?.();
        break;
      case "right":
        o.onRight?.();
        o.onAnyPress?.();
        break;
      case "up":
        o.onUp?.();
        o.onAnyPress?.();
        break;
      case "down":
        o.onDown?.();
        o.onAnyPress?.();
        break;
      case "rewind":
        o.onRewind?.();
        o.onAnyPress?.();
        break;
      case "fastForward":
        o.onFastForward?.();
        o.onAnyPress?.();
        break;
      case "select":
        o.onSelect?.();
        o.onAnyPress?.();
        break;
    }
  });
}
