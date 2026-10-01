import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutChangeEvent, ScrollView } from "react-native";
import { useForcedFocusKey } from "../../focus/focusPreview";

/**
 * Montrer ce qui a l'air focalisé AU BANC — la section entière.
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

export function useForcedFocusReveal(margin = 56) {
  const forced = useForcedFocusKey();
  const scrollRef = useRef<ScrollView>(null);
  const boxes = useRef(new Map<string, Box>());
  const handlers = useRef(new Map<string, (event: LayoutChangeEvent) => void>());
  const viewport = useRef(0);
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

  return { scrollRef, sectionLayout, onViewportLayout };
}
