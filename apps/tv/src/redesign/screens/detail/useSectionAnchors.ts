import { useCallback, useEffect, useRef, useState } from "react";
import { useForcedFocusKey } from "../../focus/focusPreview";
import type { DetailSectionKey } from "./detailTypes";

/**
 * La page suit le focus SECTION PAR SECTION, comme sur Apple TV : quand le
 * focus entre dans une section, la page s'y ancre (son titre en haut de
 * l'écran) ; revenu dans l'en-tête, elle remonte tout en haut. Ce n'est pas
 * une décision de focus — on ne dit jamais OÙ il va — seulement ce que la
 * page montre quand il y est.
 *
 * Deux sources, un seul ancrage :
 * - le focus NATIF (`onSectionFocus`, appelé par les éléments d'une section) ;
 * - le focus FIGÉ du banc : la clé figée désigne sa section par son préfixe
 *   (`episode:12` → épisodes). Tant qu'une clé est figée, le focus natif (que
 *   tvOS pose toujours quelque part) n'ancre rien.
 */

/** Où arrive le haut d'une section ancrée : sous la marge de sécurité. */
const ANCHOR_TOP = 72;
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
  // Le pied de page : assez haut pour que la DERNIÈRE section s'ancre elle
  // aussi en haut de l'écran — sans lui, une page courte s'arrêterait sur le
  // bas de l'en-tête, ses boutons coupés par le bord.
  const [tail, setTail] = useState(MIN_TAIL);
  const anchored = useRef<DetailSectionKey>("header");
  const forced = useForcedFocusKey();
  const forcedSection = forced ? sectionOfFocusKey(forced) : null;

  const anchor = useCallback(
    (key: DetailSectionKey, animated: boolean) => {
      anchored.current = key;
      if (key === "header") return scrollTo(0, animated);
      const y = positions.current.get(key);
      if (y !== undefined) scrollTo(Math.max(0, y - ANCHOR_TOP), animated);
    },
    [scrollTo],
  );

  const onSectionFocus = useCallback(
    (key: DetailSectionKey) => {
      if (forced !== null || anchored.current === key) return;
      anchor(key, true);
    },
    [anchor, forced],
  );

  // Une section qui bouge (le logo lu, une saison chargée) : si c'est elle
  // qu'on montre, la page la suit.
  const onSectionLayout = useCallback(
    (key: DetailSectionKey, y: number, height: number) => {
      const previous = positions.current.get(key);
      positions.current.set(key, y);
      heights.current.set(key, height);
      let last: DetailSectionKey | null = null;
      for (const [k, top] of positions.current) if (last === null || top > (positions.current.get(last) ?? 0)) last = k;
      if (last && last !== "header") setTail(Math.max(MIN_TAIL, SCREEN - ANCHOR_TOP - (heights.current.get(last) ?? 0)));
      if (key === anchored.current && key !== "header" && previous !== y) anchor(key, false);
    },
    [anchor],
  );

  useEffect(() => {
    if (forcedSection) anchor(forcedSection, false);
  }, [forcedSection, anchor]);

  // Le pied de page a grandi : la section montrée peut enfin monter en haut.
  useEffect(() => {
    if (anchored.current !== "header") anchor(anchored.current, false);
  }, [tail, anchor]);

  return { onSectionFocus, onSectionLayout, tail };
}
