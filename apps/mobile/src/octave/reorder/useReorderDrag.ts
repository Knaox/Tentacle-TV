/**
 * Octave mobile — le GLISSER d'une rangée par sa poignée, sur le FIL D'INTERFACE : la rangée tenue suit le
 * pouce, les autres s'écartent (valeurs partagées `from` / `over`), la page défile près d'un bord
 * (`useFrameCallback` + `scrollTo`, vitesse selon la proximité du bord, accélérée). Aucun rendu React pendant
 * le geste, hors la fenêtre de la liste : un au début, un à la fin.
 * Le geste se TERMINE TOUJOURS (bug du 30/10, défilement sans fin doigt levé) — mesuré au banc : l'ancien
 * défilement tournait sur le fil JS, saturé par le rendu de toute la liste à chaque place franchie (~14 i/s),
 * qui traitait le lâcher en retard ; et une poignée retirée en plein geste (liste rechargée, « Modifier »
 * refermé) perdait la fin du toucher et, refusant de céder, bloquait tout toucher. Désormais : la poignée
 * tenue reste montée jusqu'au lâcher, un geste fini cède toujours (`handleResponder`), filet du conteneur.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { GestureResponderEvent, GestureResponderHandlers, View } from "react-native";
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
import { haptic } from "@/utils/haptics";
import { edgeVelocity, stepOf, targetOf } from "./reorderWorklets";
import { handleResponder } from "./handleResponder";

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

  // Les gestes de chaque poignée, créés une fois et gardés (par rang ET clé) : une poignée tenue garde les
  // MÊMES gestes jusqu'au lâcher, même si la liste ou la porte (« Modifier ») change pendant le geste.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const grantRef = useRef(grant);
  grantRef.current = grant;
  const finishRef = useRef(finish);
  finishRef.current = finish;
  const cache = useRef(new Map<number, { key: string; handlers: GestureResponderHandlers }>());
  const heldKey = held?.key ?? null;
  const handlers = useCallback(
    (index: number, key: string) => {
      // Poignées coupées : plus de poignée… sauf celle qu'on tient (démontée, la fin du toucher serait perdue).
      if (!enabled && key !== heldKey) return undefined;
      const known = cache.current.get(index);
      if (known && known.key === key) return known.handlers;
      const made = handleResponder({
        enabled: () => enabledRef.current,
        live: () => live.current,
        grant: (pageY) => grantRef.current(index, key, pageY),
        move: (moved, pageY) => {
          dy.value = moved;
          pointerY.value = pageY;
        },
        finish: (commit) => finishRef.current(commit),
      });
      cache.current.set(index, { key, handlers: made });
      return made;
    },
    [dy, enabled, heldKey, pointerY],
  );

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
    heldKey,
    active: held !== null,
    handlers,
    onTouchEnd,
    onTouchCancel,
  };
}
