import { useCallback, useEffect, useRef, useState } from "react";
import { useForcedFocusKey } from "../../focus/focusPreview";
import { SECTION_ANCHOR_TOP } from "./DetailSection";
import type { DetailSectionKey } from "./detailTypes";

/**
 * La page suit le focus SECTION PAR SECTION, comme sur Apple TV : quand le
 * focus entre dans une section, la page s'y ancre (son titre en haut de
 * l'écran) ; revenu dans l'en-tête, elle remonte tout en haut.
 *
 * Dans l'app, ce sont les sections natives qui le font (`FocusSection` sur
 * `DetailSection` et l'en-tête : un seul mouvement, à la place du défilement
 * de tvOS, et la section montrée tenue en place quand la page bouge
 * au-dessus d'elle). Restent ici :
 * - le PIED de page : assez haut pour que la dernière section s'ancre elle
 *   aussi en haut de l'écran ;
 * - le focus FIGÉ du banc, qui ne déplace pas le focus natif : la clé figée
 *   désigne sa section par son préfixe (`episode:12` → épisodes), et la page
 *   s'y pose sans animation — la capture montre l'état final.
 */

/** La hauteur de l'écran, et le pied de page minimal. */
const SCREEN = 1080;
const MIN_TAIL = 140;

const SECTION_OF_PREFIX: Record<string, DetailSectionKey> = {
  detail: "header",
  season: "episodes",
  episode: "episodes",
  collection: "collection",
  cast: "cast",
  extra: "extras",
  saga: "saga",
  similar: "similar",
};

/** La section d'une clé de focus de la fiche, ou null. */
export function sectionOfFocusKey(focusKey: string): DetailSectionKey | null {
  return SECTION_OF_PREFIX[focusKey.split(":")[0]] ?? null;
}

export function useSectionAnchors(scrollTo: (y: number, animated: boolean) => void) {
  const positions = useRef(new Map<DetailSectionKey, number>());
  const heights = useRef(new Map<DetailSectionKey, number>());
  const [tail, setTail] = useState(MIN_TAIL);
  const forced = useForcedFocusKey();
  const forcedSection = forced ? sectionOfFocusKey(forced) : null;
  const forcedRef = useRef(forcedSection);
  forcedRef.current = forcedSection;

  const anchor = useCallback(
    (key: DetailSectionKey) => {
      if (key === "header") return scrollTo(0, false);
      const y = positions.current.get(key);
      if (y !== undefined) scrollTo(Math.max(0, y - SECTION_ANCHOR_TOP), false);
    },
    [scrollTo],
  );

  // Une section qui bouge (le logo lu, une saison chargée) : si c'est elle
  // que le banc montre, la page la suit.
  const onSectionLayout = useCallback(
    (key: DetailSectionKey, y: number, height: number) => {
      const previous = positions.current.get(key);
      positions.current.set(key, y);
      heights.current.set(key, height);
      let last: DetailSectionKey | null = null;
      for (const [k, top] of positions.current) if (last === null || top > (positions.current.get(last) ?? 0)) last = k;
      if (last && last !== "header") setTail(Math.max(MIN_TAIL, SCREEN - SECTION_ANCHOR_TOP - (heights.current.get(last) ?? 0)));
      if (key === forcedRef.current && key !== "header" && previous !== y) anchor(key);
    },
    [anchor],
  );

  // Le focus figé du banc, et le pied de page qui a grandi.
  useEffect(() => {
    if (forcedSection) anchor(forcedSection);
  }, [forcedSection, tail, anchor]);

  return { onSectionLayout, tail };
}
