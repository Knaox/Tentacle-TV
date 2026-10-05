import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutChangeEvent, ScrollView } from "react-native";
import { benchRevealOffset, REVEAL_NEAREST_MARGIN } from "@tentacle-tv/tv-core";
import { useForcedFocusKey } from "../../focus/focusPreview";

/**
 * Montrer ce qui a l'air focalisé AU BANC — la section entière, à la cible
 * de tv-core (`focus/reveal.ts`, `benchRevealOffset`).
 *
 * Dans l'app, c'est la section native qui le fait (`FocusSection` : la page
 * suit le focus en un seul mouvement, à la place du défilement de tvOS). Le
 * focus FIGÉ du banc (`useForcedFocusKey`), lui, ne déplace pas le focus natif
 * : le même geste est fait pour lui seul, ici, sur la section qui porte la clé
 * figée — sans animation, la capture doit montrer l'état final.
 *
 * Une section se déclare par ses préfixes de clé : `movies` couvre
 * `movies:0`, `movies:1`… ; une clé seule (`top`) se couvre elle-même. Les
 * sections doivent être des enfants DIRECTS du contenu défilant (leur `y`
 * est lu dans son repère).
 */

interface Box {
  prefixes: string[];
  y: number;
  height: number;
}

const covers = (prefixes: string[], key: string) =>
  prefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}:`));

export function useForcedFocusReveal(margin = REVEAL_NEAREST_MARGIN) {
  const forced = useForcedFocusKey();
  const scrollRef = useRef<ScrollView>(null);
  const boxes = useRef(new Map<string, Box>());
  const handlers = useRef(new Map<string, (event: LayoutChangeEvent) => void>());
  const viewport = useRef(0);
  const [layoutTick, setLayoutTick] = useState(0);
  // Hors banc (aucune clé figée), une mise en page ne redessine pas la page :
  // les cadres se notent, et servent le jour où une clé se fige.
  const forcedRef = useRef(forced);
  forcedRef.current = forced;
  const tick = useCallback(() => {
    if (forcedRef.current !== null) setLayoutTick((n) => n + 1);
  }, []);

  /** Le gestionnaire `onLayout` d'une section, stable d'un rendu à l'autre. */
  const sectionLayout = useCallback((id: string, prefixes: string[]) => {
    const current = boxes.current.get(id);
    if (current) current.prefixes = prefixes;
    let handler = handlers.current.get(id);
    if (!handler) {
      handler = (event: LayoutChangeEvent) => {
        const { y, height } = event.nativeEvent.layout;
        const box = boxes.current.get(id);
        boxes.current.set(id, { prefixes: box?.prefixes ?? prefixes, y, height });
        tick();
      };
      handlers.current.set(id, handler);
      boxes.current.set(id, { prefixes, y: current?.y ?? 0, height: current?.height ?? 0 });
    }
    return handler;
  }, [tick]);

  const onViewportLayout = useCallback(
    (event: LayoutChangeEvent) => {
      viewport.current = event.nativeEvent.layout.height;
      tick();
    },
    [tick],
  );

  useEffect(() => {
    if (!forced || viewport.current === 0) return;
    for (const box of boxes.current.values()) {
      if (!covers(box.prefixes, forced) || box.height === 0) continue;
      const y = benchRevealOffset({ top: box.y, height: box.height }, viewport.current, margin);
      scrollRef.current?.scrollTo({ y, animated: false });
      return;
    }
  }, [forced, layoutTick, margin]);

  return { scrollRef, sectionLayout, onViewportLayout };
}
