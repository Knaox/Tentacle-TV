import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type AnimatedStyle,
} from "react-native-reanimated";
import type { ViewStyle } from "react-native";
import { motionTo, type MotionPreset } from "./motion";

/**
 * Le fondu enchaîné d'un contenu qui CHANGE (la lumière du fond vivant,
 * l'image du héros qui tourne) — sur DEUX calques et une seule valeur
 * partagée, sur le fil d'interface :
 * - `dissolve` : le nouveau calque, posé dessus, entre en fondu ; l'ancien
 *   reste plein dessous jusqu'au bout — deux images opaques ne laissent
 *   jamais voir le fond entre elles ;
 * - `blend` : l'un sort pendant que l'autre entre — des lumières qui
 *   s'additionnent gardent la même force.
 *
 * Un changement qui arrive PENDANT un fondu ne l'interrompt pas : il attend
 * sa fin, et seul le dernier passe (un focus qui balaie une rangée ne fait
 * pas défiler dix lumières empilées). À la fin, le calque caché se démonte :
 * ce qui n'est plus affiché ne garde ni image ni dessin.
 */

export interface CrossfadeEntry<T> {
  key: string;
  item: T;
}

export interface CrossfadeLayer<T> {
  entry: CrossfadeEntry<T>;
  style: AnimatedStyle<ViewStyle>;
}

type Slots<T> = [CrossfadeEntry<T> | null, CrossfadeEntry<T> | null];

interface State<T> {
  slots: Slots<T>;
  /** Le calque qui se voit, ou qui entre. */
  front: 0 | 1;
  /** Un fondu de plus à chaque changement. */
  rev: number;
}

const withSlot = <T,>(slots: Slots<T>, at: number, entry: CrossfadeEntry<T> | null): Slots<T> =>
  at === 0 ? [entry, slots[1]] : [slots[0], entry];

export function useCrossfade<T>(key: string, item: T, motion: MotionPreset, mode: "dissolve" | "blend"): CrossfadeLayer<T>[] {
  const reduced = useReducedMotion();
  const [state, setState] = useState<State<T>>(() => ({ slots: [{ key, item }, null], front: 0, rev: 0 }));
  /** 0 : le calque 0 se voit ; 1 : le calque 1. */
  const mix = useSharedValue(0);
  const frontShared = useSharedValue(0);
  const busy = useRef(false);
  const latest = useRef<CrossfadeEntry<T>>({ key, item });
  latest.current = { key, item };
  const shownKey = useRef(key);

  const start = useCallback((entry: CrossfadeEntry<T>) => {
    busy.current = true;
    shownKey.current = entry.key;
    setState((s) => {
      const next = (1 - s.front) as 0 | 1;
      return { slots: withSlot(s.slots, next, entry), front: next, rev: s.rev + 1 };
    });
  }, []);

  const settled = useCallback(() => {
    busy.current = false;
    // Le calque caché se démonte ; puis le dernier changement en attente passe.
    setState((s) => ({ ...s, slots: withSlot(s.slots, 1 - s.front, null) }));
    if (latest.current.key !== shownKey.current) start(latest.current);
  }, [start]);

  // `key` EST l'identité du contenu : la même clé ne relance rien, quelle que
  // soit l'identité de `item` d'un rendu à l'autre.
  useLayoutEffect(() => {
    if (key !== shownKey.current && !busy.current) start({ key, item });
  }, [key, item, start]);

  // Le calque neuf est monté : le fondu part.
  useLayoutEffect(() => {
    if (state.rev === 0) return;
    frontShared.value = state.front;
    mix.value = motionTo(state.front, motion, reduced, (finished) => {
      "worklet";
      if (finished) runOnJS(settled)();
    });
    // Un fondu par changement : seul le numéro compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.rev]);

  const style0 = useAnimatedStyle(() => ({ opacity: visibility(0, mix.value, frontShared.value, mode) }));
  const style1 = useAnimatedStyle(() => ({ opacity: visibility(1, mix.value, frontShared.value, mode) }));
  const styles = [style0, style1];
  // De bas en haut : le calque qui entre (ou qui se voit) au-dessus.
  const order = state.front === 1 ? [0, 1] : [1, 0];
  const layers: CrossfadeLayer<T>[] = [];
  for (const slot of order) {
    const entry = state.slots[slot];
    if (entry) layers.push({ entry, style: styles[slot] });
  }
  return layers;
}

function visibility(slot: number, mix: number, front: number, mode: "dissolve" | "blend"): number {
  "worklet";
  // En `dissolve`, le calque de dessous reste plein : celui de dessus fond
  // par-dessus.
  if (mode === "dissolve" && slot !== front) return 1;
  return slot === 1 ? mix : 1 - mix;
}
