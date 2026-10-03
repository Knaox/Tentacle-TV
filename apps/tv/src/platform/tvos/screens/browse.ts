import { useEffect, useRef } from "react";
import { BROWSE_BACK_KEY, BROWSE_HEADER_KEY, browseClaimOnError, browseClaimOnItems, isGridKey } from "@tentacle-tv/tv-core";
import { useBackFocus } from "../../../redesignWiring/focus/backFocus";
import type { FocusStore } from "../focus/focusStore";

/**
 * L'applicateur tvOS de PARCOURIR — les décisions sont celles de tv-core
 * (`focus/gridFocus.ts`, relevé PA-1 à PA-3) : la croix Retour de l'en-tête
 * (seule action pendant un chargement, atteinte par HAUT ensuite), et la
 * reprise — la première affiche, ou « Réessayer », reprend le focus que la
 * croix tenait, tant qu'aucune affiche ne l'a eu.
 */
export function useBrowseFocus(focus: FocusStore, state: { entryKey: string; items: number; failed: boolean }): void {
  const { entryKey, items, failed } = state;
  // L'en-tête (ou, sur l'erreur, la bande de la croix) mène à la croix.
  useBackFocus(focus, { backKey: BROWSE_BACK_KEY, barKey: BROWSE_HEADER_KEY, entryKey });

  const posterSeen = useRef(false);
  useEffect(() => focus.subscribe((key, focused) => {
    if (focused && isGridKey(key)) posterSeen.current = true;
  }), [focus]);
  useEffect(() => {
    const target = browseClaimOnItems({ items, posterSeen: posterSeen.current, focusedKey: focus.focusedKey() });
    return target ? focus.claim(target) : undefined;
  }, [items, focus]);
  useEffect(() => {
    const target = browseClaimOnError({ failed, posterSeen: posterSeen.current, focusedKey: focus.focusedKey() });
    return target ? focus.claim(target) : undefined;
  }, [failed, focus]);
}
