import { useEffect, useRef } from "react";
import { GRID_KEY_PREFIX, gridIndexOf, gridKey, gridLineEntries, gridLineKey } from "@tentacle-tv/tv-core";
import type { FocusStore } from "./focusStore";
import { applySectionEntry } from "./sectionEntry";

/**
 * HAUT et BAS gardent la COLONNE dans une grille d'affiches (tv-core
 * `gridLineEntries`, GR-7) : au focus d'une affiche, les lignes voisines
 * déclarent leur ENTRÉE à sa colonne (`applySectionEntry` — la prop native
 * `tvEntry`, honorée par la section d'Apple TV comme par celle d'Android).
 * Les entrées d'avant s'effacent ; le focus sorti de la grille (filtres,
 * navigation), plus aucune — on y revient au plus proche, comme avant.
 *
 * Une ligne recyclée qui se remonte sous une clé déclarée reçoit son entrée
 * (le numéro natif n'existe qu'une fois monté).
 */
export function useGridLineEntries(focus: FocusStore, count: number, columns: number, prefix: string = GRID_KEY_PREFIX): void {
  const live = useRef({ count, columns });
  live.current = { count, columns };
  useEffect(() => {
    // Section → entrée déclarée.
    let declared = new Map<string, string>();
    const declare = (next: Map<string, string>) => {
      for (const section of declared.keys()) if (!next.has(section)) applySectionEntry(focus, section, null);
      for (const [section, entry] of next) if (declared.get(section) !== entry) applySectionEntry(focus, section, entry);
      declared = next;
    };
    const keyOf = (index: number) => (prefix === GRID_KEY_PREFIX ? gridKey(index) : `${prefix}:${index}`);
    const stopFocus = focus.subscribe((key, focused) => {
      if (!focused) return;
      const index = gridIndexOf(key, prefix);
      const next = new Map<string, string>();
      if (index !== null) {
        const { above, below } = gridLineEntries(index, live.current.columns, live.current.count);
        if (above) next.set(gridLineKey(prefix, above.line), keyOf(above.index));
        if (below) next.set(gridLineKey(prefix, below.line), keyOf(below.index));
      }
      declare(next);
    });
    const stopNodes = focus.subscribeNodes((key) => {
      for (const [section, entry] of declared) if (key === section || key === entry) applySectionEntry(focus, section, entry);
    });
    return () => {
      stopFocus();
      stopNodes();
      declare(new Map());
    };
  }, [focus, prefix]);
}
