/**
 * Octave mobile — le GLISSER d'une rangée par sa poignée, au doigt : la rangée tenue suit le pouce (valeur
 * partagée, fil d'interface), les autres s'écartent en ressort, la page défile d'elle-même près d'un bord, et
 * au lâcher l'ordre part (`onMove(from, to)`, rangs de la liste affichée). La géométrie est celle du bureau
 * (`dragTarget`, `rowShift`, `edgeScrollSpeed` : `@tentacle-tv/shared/octave`), à la hauteur des rangées du
 * mobile. Le défilement de la liste est coupé pendant le geste ; un appui sans mouvement ne déplace rien.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { PanResponder, type FlatList, type GestureResponderHandlers, type View } from "react-native";
import { runOnJS, useReducedMotion, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { DRAG_THRESHOLD_PX, dragTarget, edgeScrollSpeed } from "@tentacle-tv/shared/octave";
import { haptic } from "@/utils/haptics";

export interface DragState {
  from: number;
  over: number;
  /** La liste affichée au début du geste : une autre liste (l'ordre lâché arrivé) l'annule. */
  version: unknown;
}

interface Options {
  count: number;
  rowHeight: number;
  enabled: boolean;
  onMove: (from: number, to: number) => void;
  listRef: RefObject<FlatList<unknown> | null>;
  /** Le défilement courant de la liste (la valeur partagée de son `onScroll`, lue sur le fil JS). */
  readOffset: () => number;
  /** La zone visible de la liste, en coordonnées de l'écran (`measureInWindow`). */
  viewport: RefObject<View | null>;
  /** Change quand la liste affichée change : la rangée posée quitte alors son décalage. */
  rowsVersion: unknown;
}

export interface RowReorder {
  /** Le geste en cours, sur CETTE liste affichée seulement (`null` dès que l'ordre lâché est arrivé). */
  drag: DragState | null;
  /** Le déplacement de la rangée tenue (fil d'interface). */
  lift: SharedValue<number>;
  handlers: (index: number) => GestureResponderHandlers;
}

export function useRowReorder({ count, rowHeight, enabled, onMove, listRef, readOffset, viewport, rowsVersion }: Options): RowReorder {
  const [drag, setDrag] = useState<DragState | null>(null);
  const lift = useSharedValue(0);
  const live = useRef<{ from: number; over: number; startOffset: number; dy: number; pageY: number } | null>(null);
  const bounds = useRef({ top: 0, bottom: 0 });
  const frame = useRef<number | null>(null);
  const settling = useRef(false);
  // Le défilement que CE geste a demandé (la valeur partagée le rattrape une image plus tard).
  const scrolled = useRef<number | null>(null);
  const offsetNow = useCallback(() => scrolled.current ?? readOffset(), [readOffset]);
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const versionRef = useRef(rowsVersion);
  versionRef.current = rowsVersion;
  const reduced = useReducedMotion();

  // La liste affichée a pris l'ordre lâché : la rangée posée quitte son décalage, sans saut.
  useEffect(() => {
    if (!settling.current) return;
    settling.current = false;
    lift.value = 0;
    setDrag(null);
  }, [rowsVersion, lift]);

  const update = useCallback(() => {
    const g = live.current;
    if (!g) return;
    const total = g.dy + (offsetNow() - g.startOffset);
    lift.value = total;
    const over = dragTarget(g.from, total, count, rowHeight);
    if (over !== g.over) {
      g.over = over;
      haptic("select");
      setDrag({ from: g.from, over, version: versionRef.current });
    }
  }, [count, lift, offsetNow, rowHeight]);

  const stopEdge = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  const edge = useCallback(() => {
    const g = live.current;
    if (!g) return stopEdge();
    const speed = edgeScrollSpeed(g.pageY, bounds.current.top, bounds.current.bottom);
    if (speed === 0) return stopEdge();
    const next = Math.max(0, offsetNow() + speed);
    listRef.current?.scrollToOffset({ offset: next, animated: false });
    scrolled.current = next;
    update();
    frame.current = requestAnimationFrame(edge);
  }, [listRef, offsetNow, stopEdge, update]);

  const finish = useCallback(
    (commit: boolean) => {
      stopEdge();
      const g = live.current;
      live.current = null;
      scrolled.current = null;
      if (!g) return;
      if (commit && g.over !== g.from) {
        haptic("commit");
        settling.current = true;
        const { from, over } = g;
        const send = () => {
          moveRef.current(from, over);
          // Filet : si la liste ne change pas (refus), la rangée revient à sa place.
          setTimeout(() => {
            if (!settling.current) return;
            settling.current = false;
            lift.value = 0;
            setDrag(null);
          }, 400);
        };
        // La rangée se pose d'abord EXACTEMENT à sa place, puis l'ordre part : aucun saut au lâcher.
        lift.value = withTiming((over - from) * rowHeight, { duration: reduced ? 0 : 120 }, (done) => {
          if (done) runOnJS(send)();
        });
      } else {
        lift.value = withTiming(0, { duration: reduced ? 0 : 160 });
        setDrag(null);
      }
    },
    [lift, reduced, rowHeight, stopEdge],
  );

  useEffect(() => stopEdge, [stopEdge]);

  const handlers = useMemo(() => {
    const cache = new Map<number, GestureResponderHandlers>();
    return (index: number) => {
      const known = cache.get(index);
      if (known) return known;
      const responder = PanResponder.create({
        onStartShouldSetPanResponder: () => enabled,
        onMoveShouldSetPanResponder: (_e, s) => enabled && Math.abs(s.dy) > DRAG_THRESHOLD_PX,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (e) => {
          scrolled.current = null;
          live.current = { from: index, over: index, startOffset: readOffset(), dy: 0, pageY: e.nativeEvent.pageY };
          lift.value = 0;
          haptic("longPress");
          setDrag({ from: index, over: index, version: versionRef.current });
          viewport.current?.measureInWindow((_x, y, _w, h) => {
            bounds.current = { top: y, bottom: y + h };
          });
        },
        onPanResponderMove: (e, s) => {
          const g = live.current;
          if (!g) return;
          g.dy = s.dy;
          g.pageY = e.nativeEvent.pageY;
          update();
          if (frame.current === null && edgeScrollSpeed(g.pageY, bounds.current.top, bounds.current.bottom) !== 0) frame.current = requestAnimationFrame(edge);
        },
        onPanResponderRelease: () => finish(true),
        onPanResponderTerminate: () => finish(false),
      });
      cache.set(index, responder.panHandlers);
      return responder.panHandlers;
    };
  }, [edge, enabled, finish, lift, readOffset, update, viewport]);

  return { drag: drag && drag.version === rowsVersion ? drag : null, lift, handlers };
}
