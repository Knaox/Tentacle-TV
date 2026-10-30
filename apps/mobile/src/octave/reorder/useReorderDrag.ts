/**
 * Octave mobile — le GLISSER d'une rangée par sa poignée, tout sur le FIL D'INTERFACE : la rangée tenue suit
 * le pouce, les autres s'écartent (chacune lit `from` / `over`, valeurs partagées), la page défile d'elle-même
 * près d'un bord (`useFrameCallback` + `scrollTo`, vitesse selon la proximité du bord, accélérée) — aucun
 * rendu React pendant le geste : un au début (la rangée tenue, le défilement coupé), un à la fin.
 *
 * Le geste se TERMINE TOUJOURS (bug du 30/10 : remonter un titre, le doigt sur un bouton du haut, et la page
 * défilait à l'infini, doigt levé). Cause : la liste virtualisée DÉMONTAIT la rangée tenue une fois le
 * défilement automatique parti loin ; démontée, la vue qui avait reçu le toucher ne recevait plus sa fin
 * (Fabric remet les évènements tactiles à la vue touchée), et la boucle de défilement tournait sans fin.
 * Désormais : la rangée tenue reste montée (`ReorderList`), la fin arrive aussi par le conteneur
 * (`onTouchEnd`, filet), un démontage ou une poignée coupée annule, et la boucle s'arrête d'elle-même dès
 * que le geste n'est plus là ou que la page bute.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { PanResponder, type GestureResponderEvent, type GestureResponderHandlers, type View } from "react-native";
import Animated, {
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedReaction,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from "react-native-reanimated";
import { DRAG_THRESHOLD_PX } from "@tentacle-tv/shared/octave";
import { haptic } from "@/utils/haptics";
import { edgeVelocity, stepOf, targetOf } from "./reorderWorklets";

/** Ce que les rangées lisent (fil d'interface). `from` vaut -1 hors geste. */
export interface ReorderDragValues {
  from: SharedValue<number>;
  over: SharedValue<number>;
  /** La liste affichée au début du geste (`version`) : une autre liste (l'ordre arrivé) l'ignore. */
  version: SharedValue<number>;
  /** Le déplacement de la rangée tenue, défilement compris. */
  lift: SharedValue<number>;
}

interface Options {
  count: number;
  rowHeight: number;
  enabled: boolean;
  onMove: (from: number, to: number) => void;
  scrollRef: AnimatedRef<Animated.ScrollView>;
  scrollY: SharedValue<number>;
  maxScroll: SharedValue<number>;
  viewport: RefObject<View | null>;
  /** Ce que des barres recouvrent en haut et en bas de la zone qui défile : les bords « vrais » du défilement. */
  edgeInsets: { top: number; bottom: number };
  /** Change à chaque liste affichée. */
  version: number;
  /** Les places permises à la rangée tenue (sa section : file d'attente, suite du contexte) ; toute la liste sinon. */
  bounds?: (index: number) => { min: number; max: number };
}

export interface ReorderDrag {
  values: ReorderDragValues;
  /** La rangée tenue (sa clé), à garder montée tant que le geste ou son atterrissage dure ; `null` sinon. */
  heldKey: string | null;
  /** Le défilement de la page est coupé pendant le geste. */
  active: boolean;
  handlers: (index: number, key: string) => GestureResponderHandlers | undefined;
  /** Filet du conteneur : un toucher qui finit (dernier doigt levé) finit le geste. */
  onTouchEnd: (e: GestureResponderEvent) => void;
  onTouchCancel: () => void;
}

const SETTLE_MS = 120;
const CANCEL_MS = 160;
/** Sans nouvelle liste après un lâcher (refus, même ordre), la rangée revient à sa place. */
const REFUSED_MS = 450;

export function useReorderDrag({ count, rowHeight, enabled, onMove, scrollRef, scrollY, maxScroll, viewport, edgeInsets, version, bounds }: Options): ReorderDrag {
  const from = useSharedValue(-1);
  const over = useSharedValue(-1);
  const dragVersion = useSharedValue(-1);
  const lift = useSharedValue(0);
  const dy = useSharedValue(0);
  const pointerY = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const top = useSharedValue(0);
  const bottom = useSharedValue(0);
  const edgeSince = useSharedValue(-1);
  /** Le geste est tenu (doigt posé) : lu sur le fil d'interface, là où une ref ne se lit pas. */
  const alive = useSharedValue(false);
  const minOver = useSharedValue(0);
  const maxOver = useSharedValue(0);
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const reduced = useReducedMotion();
  const [held, setHeld] = useState<{ index: number; key: string; version: number } | null>(null);
  const live = useRef(false);
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const versionRef = useRef(version);
  versionRef.current = version;
  const insets = useRef(edgeInsets);
  insets.current = edgeInsets;

  // La rangée tenue suit le déplacement (doigt + défilement) ; une vibration à chaque place franchie.
  useAnimatedReaction(
    () => (alive.value && from.value >= 0 ? dy.value + scrollY.value - startScroll.value : null),
    (delta) => {
      if (delta === null || !alive.value || from.value < 0) return;
      lift.value = delta;
      const next = Math.min(maxOver.value, Math.max(minOver.value, targetOf(from.value, delta, count, rowHeight)));
      if (next !== over.value) {
        over.value = next;
        runOnJS(haptic)("select");
      }
    },
    [count, rowHeight],
  );

  // Le défilement automatique, image par image, sur le fil d'interface.
  const frame = useFrameCallback((info) => {
    if (!alive.value || from.value < 0) return;
    const v = edgeVelocity(pointerY.value, top.value, bottom.value, edgeSince.value < 0 ? 0 : info.timestamp - edgeSince.value);
    if (v === 0) {
      edgeSince.value = -1;
      return;
    }
    if (edgeSince.value < 0) edgeSince.value = info.timestamp;
    const now = scrollY.value;
    const next = Math.min(Math.max(0, now + stepOf(v, info.timeSincePreviousFrame ?? 16)), Math.max(0, maxScroll.value));
    if (next === now) return; // la page bute : rien à faire (la boucle reste sans effet)
    scrollTo(scrollRef, 0, next, false);
    scrollY.value = next;
  }, false);

  const clear = useCallback(() => {
    if (settling.current) clearTimeout(settling.current);
    settling.current = null;
    setHeld(null);
  }, []);

  const send = useCallback(
    (f: number, o: number) => {
      moveRef.current(f, o);
      settling.current = setTimeout(() => {
        settling.current = null;
        runOnUI(() => {
          "worklet";
          over.value = from.value;
          lift.value = withTiming(0, { duration: CANCEL_MS }, () => {
            from.value = -1;
          });
        })();
        setTimeout(() => setHeld(null), CANCEL_MS);
      }, REFUSED_MS);
    },
    [from, lift, over],
  );

  const finish = useCallback(
    (commit: boolean) => {
      if (!live.current) return;
      live.current = false;
      alive.value = false;
      frame.setActive(false);
      const quick = reduced;
      runOnUI((ok: boolean) => {
        "worklet";
        edgeSince.value = -1;
        const f = from.value;
        const o = over.value;
        if (f < 0) return;
        if (ok && o !== f) {
          // La rangée se pose EXACTEMENT à sa place, puis l'ordre part : aucun saut au lâcher.
          runOnJS(haptic)("commit");
          lift.value = withTiming((o - f) * rowHeight, { duration: quick ? 0 : SETTLE_MS }, (done) => {
            if (done) runOnJS(send)(f, o);
          });
        } else {
          over.value = f;
          lift.value = withTiming(0, { duration: quick ? 0 : CANCEL_MS }, () => {
            from.value = -1;
            runOnJS(clear)();
          });
        }
      })(commit);
    },
    [alive, clear, edgeSince, frame, from, lift, over, reduced, rowHeight, send],
  );

  // La liste affichée a pris l'ordre lâché : plus de geste (les rangées lisent déjà la nouvelle version).
  // Une autre liste arrivée EN PLEIN geste (rechargement) : le geste s'annule, la rangée tenue reste montée
  // (par sa clé) jusqu'au bout de l'annulation.
  const seenVersion = useRef(version);
  useLayoutEffect(() => {
    if (seenVersion.current === version) return;
    seenVersion.current = version;
    if (live.current) {
      finish(false);
      return;
    }
    if (settling.current) clearTimeout(settling.current);
    settling.current = null;
    from.value = -1;
    setHeld(null);
  }, [finish, from, version]);

  // Poignées coupées (fin de « Modifier ») ou page quittée en plein geste : le geste s'annule, la boucle s'arrête.
  useEffect(() => {
    if (!enabled) finish(false);
  }, [enabled, finish]);
  useEffect(
    () => () => {
      live.current = false;
      alive.value = false;
      frame.setActive(false);
      from.value = -1;
      if (settling.current) clearTimeout(settling.current);
    },
    [alive, frame, from],
  );

  const grant = useCallback(
    (index: number, key: string, pageY: number) => {
      if (live.current || from.value >= 0) return false;
      live.current = true;
      alive.value = true;
      startScroll.value = scrollY.value;
      dy.value = 0;
      lift.value = 0;
      pointerY.value = pageY;
      edgeSince.value = -1;
      dragVersion.value = versionRef.current;
      const allowed = boundsRef.current?.(index) ?? { min: 0, max: count - 1 };
      minOver.value = allowed.min;
      maxOver.value = allowed.max;
      over.value = index;
      from.value = index;
      setHeld({ index, key, version: versionRef.current });
      haptic("longPress");
      viewport.current?.measureInWindow((_x, y, _w, h) => {
        top.value = y + insets.current.top;
        bottom.value = y + h - insets.current.bottom;
        frame.setActive(true);
      });
      return true;
    },
    [alive, bottom, count, dragVersion, dy, edgeSince, frame, from, lift, maxOver, minOver, over, pointerY, scrollY, startScroll, top, viewport],
  );

  const handlers = useMemo(() => {
    const cache = new Map<number, { key: string; handlers: GestureResponderHandlers }>();
    return (index: number, key: string) => {
      if (!enabled) return undefined;
      const known = cache.get(index);
      if (known && known.key === key) return known.handlers;
      const responder = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, s) => Math.abs(s.dy) > DRAG_THRESHOLD_PX,
        // Jamais rendu : ni la page, ni un bouton survolé (la barre du haut) ne prend le geste.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (e) => {
          grant(index, key, e.nativeEvent.pageY);
        },
        onPanResponderMove: (e, s) => {
          if (!live.current) return;
          dy.value = s.dy;
          pointerY.value = e.nativeEvent.pageY;
        },
        onPanResponderRelease: () => finish(true),
        onPanResponderTerminate: () => finish(false),
      });
      cache.set(index, { key, handlers: responder.panHandlers });
      return responder.panHandlers;
    };
  }, [dy, enabled, finish, grant, pointerY]);

  const onTouchEnd = useCallback(
    (e: GestureResponderEvent) => {
      if (live.current && (e.nativeEvent.touches?.length ?? 0) === 0) finish(true);
    },
    [finish],
  );
  const onTouchCancel = useCallback(() => finish(false), [finish]);

  const values = useMemo(() => ({ from, over, version: dragVersion, lift }), [dragVersion, from, lift, over]);
  return {
    values,
    // Gardée par sa CLÉ, même si la liste change en plein geste : la vue touchée n'est jamais démontée.
    heldKey: held?.key ?? null,
    active: held !== null,
    handlers,
    onTouchEnd,
    onTouchCancel,
  };
}
