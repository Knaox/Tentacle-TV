import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView } from "react-native";
import { useForcedFocusKey } from "../../focus/focusPreview";

/**
 * Montrer ce qui a l'air focalisé — la section ENTIÈRE.
 *
 * Dans l'app, le focus NATIF fait défiler la page tout seul : tvOS amène
 * l'élément focalisé à l'écran — la carte, pas ce qui la suit (sa légende, la
 * raison d'une recommandation, l'indication de l'appui long), qui tombait au
 * bord bas, dans la marge de sécurité. `revealSection` y remédie : appelé
 * quand une carte d'une section prend le focus, il amène la section entière à
 * l'écran, avec le moins de défilement possible depuis la position courante.
 *
 * Le focus FIGÉ du banc (`useForcedFocusKey`) ne déplace rien : le même geste
 * est fait pour lui seul, sur la section qui porte la clé figée.
 *
 * Une section se déclare par ses préfixes de clé : `movies` couvre
 * `movies:0`, `movies:1`… ; une clé seule (`top`) se couvre elle-même. Les
 * sections doivent être des enfants DIRECTS du contenu défilant (leur `y`
 * est lu dans son repère). La position courante vient de `onScroll`, à poser
 * sur la ScrollView avec `scrollEventThrottle`.
 */

interface Box {
  prefixes: string[];
  y: number;
  height: number;
}

const covers = (prefixes: string[], key: string) =>
  prefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}:`));

export function useForcedFocusReveal(margin = 56) {
  const forced = useForcedFocusKey();
  const forcedRef = useRef(forced);
  forcedRef.current = forced;
  const scrollRef = useRef<ScrollView>(null);
  const boxes = useRef(new Map<string, Box>());
  const handlers = useRef(new Map<string, (event: LayoutChangeEvent) => void>());
  const viewport = useRef(0);
  const offset = useRef(0);
  const [layoutTick, setLayoutTick] = useState(0);

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
        setLayoutTick((tick) => tick + 1);
      };
      handlers.current.set(id, handler);
      boxes.current.set(id, { prefixes, y: current?.y ?? 0, height: current?.height ?? 0 });
    }
    return handler;
  }, []);

  const onViewportLayout = useCallback((event: LayoutChangeEvent) => {
    viewport.current = event.nativeEvent.layout.height;
    setLayoutTick((tick) => tick + 1);
  }, []);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
  }, []);

  useEffect(() => {
    if (!forced || viewport.current === 0) return;
    for (const box of boxes.current.values()) {
      if (!covers(box.prefixes, forced) || box.height === 0) continue;
      const bottom = box.y + box.height;
      const y = bottom > viewport.current - margin ? bottom - viewport.current + margin : 0;
      scrollRef.current?.scrollTo({ y: Math.max(0, Math.min(y, box.y - margin)), animated: false });
      return;
    }
  }, [forced, layoutTick, margin]);

  /** Le focus natif sur une carte de la section `id` : la section entière à l'écran. */
  const revealSection = useCallback(
    (id: string) => {
      const box = boxes.current.get(id);
      if (forcedRef.current !== null || !box || box.height === 0 || viewport.current === 0) return;
      const current = offset.current;
      const top = box.y - margin;
      const bottom = box.y + box.height + margin - viewport.current;
      // Le moins possible : descendre jusqu'à son bas, sinon remonter jusqu'à son
      // haut — et jamais au-delà de son haut (une section plus haute que l'écran).
      const target = bottom > current ? Math.min(bottom, top) : top < current ? top : current;
      if (Math.abs(target - current) < 2) return;
      scrollRef.current?.scrollTo({ y: Math.max(0, target), animated: true });
    },
    [margin],
  );

  return { scrollRef, sectionLayout, onViewportLayout, onScroll, revealSection };
}
