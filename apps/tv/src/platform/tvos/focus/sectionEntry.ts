import { useEffect, useRef, useState } from "react";
import { FIRST_VISIT_ARMED, firstVisitAfterFocus, firstVisitEntry, type FirstVisitEntryState } from "@tentacle-tv/tv-core";
import type { FocusStore } from "./focusStore";

/**
 * L'ENTRÉE déclarée d'une section (`FocusSection`) : l'élément sur lequel
 * HAUT / BAS y arrive depuis une section voisine, à la place de l'élément au
 * centre le plus proche — la seule exception de la règle de voisinage
 * (`sectionNeighbors.ts`), posée par l'intégration : l'onglet de la saison
 * affichée, l'épisode à reprendre. La politique « première visite » est la
 * règle de tv-core (`focus/sectionEntry.ts`) ; ce module l'applique.
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

export interface FirstVisitEntryOptions {
  /** Les clés de la section : leur premier focus la désarme. */
  owns: (focusKey: string) => boolean;
  /** L'ancre, déclarée tant que c'est armé (l'épisode à reprendre). */
  anchorKey: string | null;
  /** Réarme quand elle change (la saison choisie). */
  resetKey: unknown;
}

/**
 * L'entrée « première visite » d'une section : `anchorKey` jusqu'au premier
 * focus d'une de ses clés, puis `null` (le plus proche) — réarmée à chaque
 * changement de `resetKey`. À passer à `useSectionEntry`.
 */
export function useFirstVisitEntry(focus: FocusStore, { owns, anchorKey, resetKey }: FirstVisitEntryOptions): string | null {
  const [state, setState] = useState<FirstVisitEntryState>(FIRST_VISIT_ARMED);
  const live = useRef({ state, owns });
  live.current = { state, owns };
  useEffect(() => setState(FIRST_VISIT_ARMED), [resetKey]);
  useEffect(
    () =>
      focus.subscribe((key, focused) => {
        if (!focused) return;
        const next = firstVisitAfterFocus(live.current.state, key, live.current.owns);
        if (next !== live.current.state) setState(next);
      }),
    [focus],
  );
  return firstVisitEntry(state, anchorKey);
}
