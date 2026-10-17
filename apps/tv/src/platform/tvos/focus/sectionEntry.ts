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

/** La prop native de la section qui désigne un de ses éléments : l'entrée, ou la tête. */
type SectionPointer = "tvEntry" | "tvHead";

function applySectionPointer(focus: FocusStore, prop: SectionPointer, sectionKey: string, elementKey: string | null): void {
  const handle = elementKey ? focus.handle(elementKey) : null;
  (focus.node(sectionKey) as Settable | null)?.setNativeProps?.({ [prop]: handle });
}

export function applySectionEntry(focus: FocusStore, sectionKey: string, entryKey: string | null): void {
  applySectionPointer(focus, "tvEntry", sectionKey, entryKey);
}

/** Tient la prop `prop` de `sectionKey` sur `elementKey` — reposée quand la
 *  section ou l'élément se montent (le numéro natif n'existe qu'une fois monté). */
function useSectionPointer(focus: FocusStore, prop: SectionPointer, sectionKey: string | null, elementKey: string | null): void {
  const live = useRef(elementKey);
  live.current = elementKey;
  useEffect(() => {
    if (sectionKey) applySectionPointer(focus, prop, sectionKey, elementKey);
  }, [focus, prop, sectionKey, elementKey]);
  useEffect(() => {
    if (!sectionKey) return undefined;
    return focus.subscribeNodes((key) => {
      if (key === sectionKey || key === live.current) applySectionPointer(focus, prop, sectionKey, live.current);
    });
  }, [focus, prop, sectionKey]);
}

/** Tient l'entrée de `sectionKey` sur `entryKey`. */
export function useSectionEntry(focus: FocusStore, sectionKey: string, entryKey: string | null): void {
  useSectionPointer(focus, "tvEntry", sectionKey, entryKey);
}

/**
 * Tient la TÊTE de `sectionKey` sur `headKey` (prop native `tvHead`) : HAUT
 * depuis la première carte de sa ligne y va, à l'aplomb ou non — la règle de
 * tv-core `headFromFirst` (`focus/sections.ts`), appliquée par la section
 * native d'Apple TV comme par celle d'Android. `null` : plus de tête.
 */
export function useSectionHead(focus: FocusStore, sectionKey: string | null, headKey: string | null): void {
  useSectionPointer(focus, "tvHead", sectionKey, headKey);
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
