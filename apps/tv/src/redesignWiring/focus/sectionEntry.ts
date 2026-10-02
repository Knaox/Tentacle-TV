import { useEffect, useRef } from "react";
import type { FocusStore } from "./focusStore";

/**
 * L'ENTRÉE déclarée d'une section (`FocusSection`) : l'élément sur lequel
 * HAUT / BAS y arrive depuis une section voisine, à la place de l'élément au
 * centre le plus proche — la seule exception de la règle de voisinage
 * (`sectionNeighbors.ts`), posée par l'intégration : l'onglet de la saison
 * affichée, l'épisode à reprendre.
 *
 * Sur Apple TV, c'est la prop native `tvEntry` de la section (le numéro natif
 * de l'élément), posée sur son nœud : la section native l'honore au moment du
 * geste, si l'élément est monté et focalisable. `null` : plus d'entrée.
 */

type Settable = { setNativeProps?: (props: object) => void };

export function applySectionEntry(focus: FocusStore, sectionKey: string, entryKey: string | null): void {
  const handle = entryKey ? focus.handle(entryKey) : null;
  (focus.node(sectionKey) as Settable | null)?.setNativeProps?.({ tvEntry: handle });
}

/** Tient l'entrée de `sectionKey` sur `entryKey` — reposée quand la section
 *  ou l'élément se montent (le numéro natif n'existe qu'une fois monté). */
export function useSectionEntry(focus: FocusStore, sectionKey: string, entryKey: string | null): void {
  const live = useRef(entryKey);
  live.current = entryKey;
  useEffect(() => applySectionEntry(focus, sectionKey, entryKey), [focus, sectionKey, entryKey]);
  useEffect(
    () =>
      focus.subscribeNodes((key) => {
        if (key === sectionKey || key === live.current) applySectionEntry(focus, sectionKey, live.current);
      }),
    [focus, sectionKey],
  );
}
