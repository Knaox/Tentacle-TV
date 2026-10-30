/**
 * Octave mobile — les GESTES d'une poignée de `ReorderList` (PanResponder). Tenu, le geste n'est jamais rendu :
 * ni la page, ni un bouton survolé (la barre du haut) ne le prend. Fini ou annulé, il cède TOUJOURS : si la fin
 * d'un toucher se perd (vue touchée démontée), le toucher suivant reprend la main — jamais une application
 * dont plus aucun toucher ne passe.
 */

import { PanResponder, type GestureResponderHandlers } from "react-native";
import { DRAG_THRESHOLD_PX } from "@tentacle-tv/shared/octave";

export interface HandleGestureOps {
  /** Les poignées sont ouvertes (lu à chaque toucher). */
  enabled: () => boolean;
  /** Un geste est tenu. */
  live: () => boolean;
  grant: (pageY: number) => void;
  move: (dy: number, pageY: number) => void;
  finish: (commit: boolean) => void;
}

export function handleResponder(ops: HandleGestureOps): GestureResponderHandlers {
  return PanResponder.create({
    onStartShouldSetPanResponder: () => ops.enabled(),
    onMoveShouldSetPanResponder: (_e, s) => ops.enabled() && Math.abs(s.dy) > DRAG_THRESHOLD_PX,
    onPanResponderTerminationRequest: () => !ops.live(),
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: (e) => ops.grant(e.nativeEvent.pageY),
    onPanResponderMove: (e, s) => {
      if (ops.live()) ops.move(s.dy, e.nativeEvent.pageY);
    },
    onPanResponderRelease: () => ops.finish(true),
    onPanResponderTerminate: () => ops.finish(false),
  }).panHandlers;
}
