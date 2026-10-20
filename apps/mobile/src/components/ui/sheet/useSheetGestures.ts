import { useMemo, useRef } from "react";
import { Animated, PanResponder, type GestureResponderEvent, type PanResponderGestureState } from "react-native";
import { decideSheetRelease, sheetCapturesFromContent, sheetDragOffset, sheetHeaderClaimsMove, type SheetSnap } from "./sheetSnap";
import type { SheetScrollBridge } from "./sheetScroll";

interface Live {
  snap: SheetSnap;
  minH: number;
  maxH: number;
  canExpand: boolean;
  setSnap: (snap: SheetSnap) => void;
  dismiss: () => void;
}

/**
 * Les gestes d'une feuille à deux crans : la POIGNÉE et l'en-tête prennent
 * tout glissement vertical ; le CONTENU ne le prend que quand la règle le dit
 * (`sheetCapturesFromContent` : agrandir d'abord, réduire depuis le haut
 * d'une liste branchée). Les répondeurs sont créés une fois et lisent l'état
 * courant par une référence.
 */
export function useSheetGestures(translateY: Animated.Value, live: Live) {
  const ref = useRef(live);
  ref.current = live;
  const scrollState = useRef<{ atTop: boolean | null }>({ atTop: null }).current;

  const handlers = useMemo(() => {
    const move = (_: GestureResponderEvent, g: PanResponderGestureState) => {
      const { snap, minH, maxH } = ref.current;
      translateY.setValue(sheetDragOffset({ snap, dy: g.dy, minH, maxH }));
    };
    const release = (_: GestureResponderEvent, g: PanResponderGestureState) => {
      const { snap, canExpand, setSnap, dismiss } = ref.current;
      const decision = decideSheetRelease({ snap, dy: g.dy, vy: g.vy, canExpand });
      if (decision === "dismiss") dismiss();
      else if (decision === "expand") setSnap(1);
      else if (decision === "collapse") setSnap(0);
      else setSnap(snap);
    };
    const base = {
      onPanResponderMove: move,
      onPanResponderRelease: release,
      onPanResponderTerminate: release,
      onPanResponderTerminationRequest: () => false,
    };
    const handle = PanResponder.create({
      ...base,
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => sheetHeaderClaimsMove({ dx: g.dx, dy: g.dy }),
    });
    const content = PanResponder.create({
      ...base,
      onMoveShouldSetPanResponderCapture: (_e, g) => {
        const { snap, canExpand } = ref.current;
        return sheetCapturesFromContent({ snap, dx: g.dx, dy: g.dy, canExpand, scrollTop: scrollState.atTop });
      },
    });
    return { handle: handle.panHandlers, content: content.panHandlers };
  }, [translateY, scrollState]);

  // Stable : la liste branchée ne se rebranche pas à chaque cran.
  const bridge = useMemo<SheetScrollBridge>(() => ({ state: scrollState }), [scrollState]);

  return { handleHandlers: handlers.handle, contentHandlers: handlers.content, bridge };
}
